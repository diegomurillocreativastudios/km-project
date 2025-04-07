// Toggle selection state of a duplicate record
import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import _ from 'lodash';

const DataNormalizer = () => {
  const [csvData, setCsvData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedField, setSelectedField] = useState('Agreement Classification');
  const [similarityThreshold, setSimilarityThreshold] = useState(0.5);
  const [frequencies, setFrequencies] = useState({});
  const [similarPairs, setSimilarPairs] = useState([]);
  const [normalizedData, setNormalizedData] = useState([]);
  const [changesMap, setChangesMap] = useState({});
  const [fileName, setFileName] = useState('normalized_contract_data.csv');
  const [carrierNames, setCarrierNames] = useState([]);
  const [useLookupTable, setUseLookupTable] = useState(false);

  const toggleDuplicateSelection = (groupKey, recordIndex) => {
    setSelectedDuplicates(prev => {
      const newSelection = { ...prev };
      newSelection[groupKey] = [...newSelection[groupKey]];
      newSelection[groupKey][recordIndex] = !newSelection[groupKey][recordIndex];
      return newSelection;
    });
  };

  // Field mapping for compatibility with new CSV structure
  const fieldMapping = {
    'Agreement Title': 'Agreement Name',
    'Agreement Date': 'Effective Date',
    'Monthly Recurring Charges (MRC)': 'Recurring Monthly Charges',
    'Nonrecurring Charges (NRC)': 'Nonrecurring Charges',
    'Service Locations': 'Locations'
  };

  // State for custom values in similar pairs
  const [customValues, setCustomValues] = useState({});
  const [editingStates, setEditingStates] = useState({});
  const [duplicates, setDuplicates] = useState([]);
  const [selectedDuplicates, setSelectedDuplicates] = useState({});
  const [showDuplicatesStep, setShowDuplicatesStep] = useState(true);
  const [showAnalysisStep, setShowAnalysisStep] = useState(false);
  const [showNormalizationStep, setShowNormalizationStep] = useState(false);

  // Updated fieldsToAnalyze: "Services" field is now "Connection Services"
  const fieldsToAnalyze = [
    'Agreement Classification',
    'Party1 Name',
    'Party2 Name',
    'Connection Services',
    'Agreement Title'
  ];

  // Add new helper function
  const findCarrierMatch = (name) => {
    if (!name || !carrierNames.length) return null;
    
    const normalizedInput = name.toLowerCase().trim();
    
    return carrierNames.find(carrier => {
      const variations = [
        carrier.Name,
        carrier.Alias1,
        carrier.Alias2,
        carrier.Alias3
      ].filter(Boolean).map(v => v.toLowerCase().trim());
      
      return variations.some(v => 
        normalizedInput.includes(v) || v.includes(normalizedInput)
      );
    });
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/data/contract_analysis_output (4-6).csv');
        const text = await response.text();
        
        Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          complete: (result) => {
            // For each row, adjust the "Connection Services" field: parse as JSON and use only the first element
            const adjustedData = result.data.map(row => {
              if (row["Connection Services"]) {
                try {
                  const parsed = JSON.parse(row["Connection Services"]);
                  if (Array.isArray(parsed) && parsed.length > 0) {
                    row["Connection Services"] = parsed[0];
                  } else {
                    row["Connection Services"] = "";
                  }
                } catch (error) {
                  // If parsing fails, leave the original value
                }
              }
              return row;
            });
            
            setCsvData(adjustedData);
            calculateFrequencies(adjustedData);
            setNormalizedData(adjustedData);
            // Find duplicates in the loaded data
            findDuplicates(adjustedData);
            setLoading(false);
          },
          error: (error) => {
            setError(`Error parsing CSV: ${error.message}`);
            setLoading(false);
          }
        });
      } catch (error) {
        setError(`Error loading file: ${error.message}`);
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  useEffect(() => {
    const loadCarrierNames = async () => {
      try {
        const response = await fetch('/data/CarrierNames.csv');
        const text = await response.text();
        
        Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            setCarrierNames(results.data);
          }
        });
      } catch (error) {
        console.error('Error loading carrier names:', error);
      }
    };

    loadCarrierNames();
  }, []);

  // Check for duplicates in the data
  const findDuplicates = (data) => {
    // Group records by key fields that would identify duplicates
    // Using Agreement Title, Agreement Classification, Party1 Name, Party2 Name, Agreement Date, and Term
    const groupedData = _.groupBy(data, record => {
      return `${record['Agreement Title']?.trim()}|${record['Agreement Classification']?.trim()}|${record['Party1 Name']?.trim()}|${record['Party2 Name']?.trim()}|${record['Agreement Date']?.trim()}|${record['Term']?.trim()}`;
    });
    
    // Find groups with more than one record (these are duplicates)
    const duplicateGroups = Object.entries(groupedData)
      .filter(([key, group]) => group.length > 1)
      .map(([key, group]) => ({
        key,
        records: group,
        count: group.length
      }));
    
    // Initialize selected duplicates (default to keeping the first record in each group)
    const initialSelectedDups = {};
    duplicateGroups.forEach(group => {
      initialSelectedDups[group.key] = group.records.map((record, index) => index === 0);
    });
    
    setDuplicates(duplicateGroups);
    setSelectedDuplicates(initialSelectedDups);
  };
  
  // Remove selected duplicates from the data
  const removeDuplicates = () => {
    // Create a new dataset without the selected duplicates
    let newData = [...normalizedData];
    
    // For each duplicate group, identify which records to remove
    duplicates.forEach(group => {
      const selectedInGroup = selectedDuplicates[group.key];
      
      // Remove records that aren't selected (false in selectedInGroup)
      group.records.forEach((record, index) => {
        if (!selectedInGroup[index]) {
          // Find this record in the newData array
          const recordIndex = newData.findIndex(r => 
            r['source_filename'] === record['source_filename'] &&
            r['Agreement Title'] === record['Agreement Title'] &&
            r['Agreement Classification'] === record['Agreement Classification'] &&
            r['Party1 Name'] === record['Party1 Name'] &&
            r['Party2 Name'] === record['Party2 Name'] &&
            r['Agreement Date'] === record['Agreement Date'] &&
            r['Term'] === record['Term']
          );
          
          if (recordIndex !== -1) {
            // Remove it from the array
            newData.splice(recordIndex, 1);
          }
        }
      });
    });
    
    // Update the normalized data with duplicates removed
    setNormalizedData(newData);
    
    // Calculate how many were removed
    const originalCount = normalizedData.length;
    const newCount = newData.length;
    const removedCount = originalCount - newCount;
    
    // Show confirmation and move to next step
    alert(`Successfully removed ${removedCount} duplicate records. ${newCount} records remaining.`);
    setShowDuplicatesStep(false);
    setShowAnalysisStep(true);
  };
  
  // Toggle editing state for a pair
  const toggleEditing = (pairId) => {
    setEditingStates(prev => ({
      ...prev,
      [pairId]: !prev[pairId]
    }));
  };
  
  // Update custom value for a pair
  const updateCustomValue = (pairId, value) => {
    setCustomValues(prev => ({
      ...prev,
      [pairId]: value
    }));
  };

  // Calculate frequency of unique values for each field
  const calculateFrequencies = (data) => {
    const freqs = {};
    
    fieldsToAnalyze.forEach(field => {
      const valueMap = {};
      
      data.forEach(row => {
        const value = row[field];
        if (value) {
          const trimmedValue = String(value).trim();
          valueMap[trimmedValue] = (valueMap[trimmedValue] || 0) + 1;
        }
      });
      
      // Convert to array and sort by frequency (descending)
      freqs[field] = Object.entries(valueMap)
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count);
    });
    
    setFrequencies(freqs);
  };

  // Calculate Jaccard similarity between two strings
  const jaccardSimilarity = (str1, str2) => {
    // Convert strings to sets of words
    const set1 = new Set(str1.toLowerCase().split(/\s+/));
    const set2 = new Set(str2.toLowerCase().split(/\s+/));
    
    // Calculate intersection size
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    
    // Calculate union size
    const union = new Set([...set1, ...set2]);
    
    // Return Jaccard similarity
    return intersection.size / union.size;
  };

  // Find similar values when field or threshold changes
  useEffect(() => {
    if (frequencies[selectedField]) {
      findSimilarValues();
    }
  }, [selectedField, similarityThreshold, frequencies]);

  // Find similar values based on Jaccard similarity
  const findSimilarValues = () => {
    const values = frequencies[selectedField];
    const pairs = [];
    const newCustomValues = {};
    const newEditingStates = {};
    
    for (let i = 0; i < values.length; i++) {
      for (let j = i + 1; j < values.length; j++) {
        const similarity = jaccardSimilarity(values[i].value, values[j].value);
        if (similarity >= similarityThreshold) {
          const pairId = `${values[i].value}|${values[j].value}`;
          const targetValue = values[i].count >= values[j].count ? values[i].value : values[j].value;
          
          pairs.push({
            id: pairId,
            value1: values[i].value,
            value2: values[j].value,
            similarity: similarity.toFixed(2),
            counts: [values[i].count, values[j].count],
            targetValue: targetValue
          });
          
          // Initialize custom values and editing states
          newCustomValues[pairId] = targetValue;
          newEditingStates[pairId] = false;
        }
      }
    }
    
    setCustomValues(newCustomValues);
    setEditingStates(newEditingStates);
    setSimilarPairs(pairs);
  };

  // Apply normalization for a single pair with optional custom target value
  const applyNormalization = (pair, customTargetValue = null) => {
    const newChangesMap = { ...changesMap };
    
    // Determine source and target values
    const sourceValue = pair.value1 === pair.targetValue ? pair.value2 : pair.value1;
    const targetValue = customTargetValue || pair.targetValue;
    
    // Update changes map
    if (!newChangesMap[selectedField]) {
      newChangesMap[selectedField] = {};
    }
    newChangesMap[selectedField][sourceValue] = targetValue;
    
    // Apply the changes to the data
    const newData = normalizedData.map(row => {
      const newRow = { ...row };
      if (newRow[selectedField] === sourceValue) {
        newRow[selectedField] = targetValue;
      }
      return newRow;
    });
    
    setNormalizedData(newData);
    setChangesMap(newChangesMap);
    
    // Recalculate frequencies with normalized data
    calculateFrequencies(newData);
  };

  // In the Value Normalization Step section
  {showNormalizationStep && selectedField === 'Party1 Name' && (
    <div className="mb-4">
      <label className="flex items-center space-x-2">
        <input
          type="checkbox"
          checked={useLookupTable}
          onChange={() => {
            setUseLookupTable(!useLookupTable);
            if (!useLookupTable) {
              // When enabling lookup, try to match all values
              const newChangesMap = { ...changesMap };
              if (!newChangesMap['Party1 Name']) {
                newChangesMap['Party1 Name'] = {};
              }
  
              frequencies['Party1 Name']?.forEach(item => {
                const match = findCarrierMatch(item.value);
                if (match) {
                  newChangesMap['Party1 Name'][item.value] = match.Name;
                }
              });
  
              setChangesMap(newChangesMap);
            }
          }}
          className="form-checkbox h-4 w-4 text-blue-600"
        />
        <span>Use Carrier Names Lookup Table</span>
      </label>
    </div>
  )}

  // Apply all suggested normalizations at once
  const applyAllNormalizations = () => {
    const newChangesMap = { ...changesMap };
    if (!newChangesMap[selectedField]) {
      newChangesMap[selectedField] = {};
    }
    
    // Build a map of all changes to apply
    similarPairs.forEach(pair => {
      const sourceValue = pair.value1 === pair.targetValue ? pair.value2 : pair.value1;
      newChangesMap[selectedField][sourceValue] = pair.targetValue;
    });
    
    // Apply all changes at once
    const newData = normalizedData.map(row => {
      const newRow = { ...row };
      if (newChangesMap[selectedField][newRow[selectedField]]) {
        newRow[selectedField] = newChangesMap[selectedField][newRow[selectedField]];
      }
      return newRow;
    });
    
    setNormalizedData(newData);
    setChangesMap(newChangesMap);
    
    // Recalculate frequencies with normalized data
    calculateFrequencies(newData);
  };

  // Simple, direct export function to ensure file downloads properly
  const exportNormalizedCSV = (customFileName) => {
    try {
      // Ensure filename has .csv extension
      let finalFileName = customFileName || fileName || 'normalized_contract_data.csv';
      if (!finalFileName.toLowerCase().endsWith('.csv')) {
        finalFileName += '.csv';
      }
      
      // Store the filename for future use
      setFileName(finalFileName);
      
      // Generate CSV content
      const csv = Papa.unparse(normalizedData, {
        header: true,
        delimiter: ","
      });
      
      // Create data URI for direct download
      // This is the most reliable method across browsers
      const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
      
      // Create simple download link
      const link = document.createElement('a');
      link.setAttribute('href', csvContent);
      link.setAttribute('download', finalFileName);
      document.body.appendChild(link);
      
      // Trigger click synchronously
      link.click();
      
      // Remove link from DOM
      document.body.removeChild(link);
      
      // Show user confirmation
      alert(`File "${finalFileName}" has been downloaded to your Downloads folder.`);
    } catch (error) {
      console.error("Download failed:", error);
      alert(`Error downloading file: ${error.message}. Please try again.`);
    }
  };

  if (loading) {
    return <div className="p-4 text-center">Loading data...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">{error}</div>;
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">CSV Data Normalizer</h1>
      
      {/* Duplicates Step */}
      {showDuplicatesStep && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Step 1: Identify and Remove Duplicates</h2>
          <p className="mb-4">
            Found {duplicates.length} groups of potential duplicate records based on Agreement Title, Agreement Classification, Party1 Name, Party2 Name, Agreement Date, and Term.
            {duplicates.length === 0 && " No action needed."}
          </p>
          
          {duplicates.length > 0 && (
            <>
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  Select which records to keep for each group of duplicates. By default, the first record is selected.
                </p>
                <div className="flex gap-2">
                  <button
                    className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                    onClick={removeDuplicates}
                  >
                    Remove Unselected Duplicates
                  </button>
                  <button
                    className="border border-gray-300 px-4 py-2 rounded hover:bg-gray-100"
                    onClick={() => {
                      setShowDuplicatesStep(false);
                      setShowAnalysisStep(true);
                    }}
                  >
                    Skip This Step
                  </button>
                </div>
              </div>
              
              <div className="bg-gray-100 p-4 rounded max-h-96 overflow-y-auto">
                {duplicates.map((group, groupIndex) => (
                  <div key={groupIndex} className="mb-6 p-3 bg-white rounded shadow">
                    <h3 className="font-semibold mb-2">
                      Duplicate Group {groupIndex + 1}: {group.count} records
                    </h3>
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-gray-200">
                          <th className="p-2 text-left">Keep</th>
                          <th className="p-2 text-left">Source File</th>
                          <th className="p-2 text-left">Agreement Title</th>
                          <th className="p-2 text-left">Classification</th>
                          <th className="p-2 text-left">Party1 Name</th>
                          <th className="p-2 text-left">Party2 Name</th>
                          <th className="p-2 text-left">Agreement Date</th>
                          <th className="p-2 text-left">Term</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.records.map((record, recordIndex) => (
                          <tr key={recordIndex} className="border-t hover:bg-gray-50">
                            <td className="p-2">
                              <input
                                type="checkbox"
                                checked={selectedDuplicates[group.key][recordIndex]}
                                onChange={() => toggleDuplicateSelection(group.key, recordIndex)}
                              />
                            </td>
                            <td className="p-2">{record['source_filename']}</td>
                            <td className="p-2">{record['Agreement Title']}</td>
                            <td className="p-2">{record['Agreement Classification']}</td>
                            <td className="p-2">{record['Party1 Name']}</td>
                            <td className="p-2">{record['Party2 Name']}</td>
                            <td className="p-2">{record['Agreement Date']}</td>
                            <td className="p-2">{record['Term']}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </>
          )}
          
          {duplicates.length === 0 && (
            <button
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              onClick={() => {
                setShowDuplicatesStep(false);
                setShowAnalysisStep(true);
              }}
            >
              Continue to Value Analysis
            </button>
          )}
        </div>
      )}
      
      {/* Unique Values Analysis Step */}
      {showAnalysisStep && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Step 2: Unique Values Analysis</h2>
          <div className="mb-4">
            <label className="block mb-2">Select Field to Analyze:</label>
            <select 
              className="p-2 border rounded w-full md:w-64"
              value={selectedField}
              onChange={(e) => setSelectedField(e.target.value)}
            >
              {fieldsToAnalyze.map(field => (
                <option key={field} value={field}>{field}</option>
              ))}
            </select>
          </div>
          
          <div className="bg-gray-100 p-4 rounded">
            <h3 className="font-semibold mb-2">
              {selectedField}: {frequencies[selectedField]?.length || 0} unique values
            </h3>
            <div className="max-h-60 overflow-y-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="p-2 text-left">Value</th>
                    <th className="p-2 text-right">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {frequencies[selectedField]?.map((item, index) => (
                    <tr key={index} className="border-t">
                      <td className="p-2">{item.value}</td>
                      <td className="p-2 text-right">{item.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="mt-4 flex gap-2">
            <button
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              onClick={() => {
                setShowAnalysisStep(false);
                setShowNormalizationStep(true);
              }}
            >
              Continue to Value Normalization
            </button>
            <button
              className="border border-gray-300 px-4 py-2 rounded hover:bg-gray-100"
              onClick={() => {
                setShowAnalysisStep(false);
                setShowDuplicatesStep(true);
              }}
            >
              Back to Duplicates
            </button>
          </div>
        </div>
      )}
      
      {/* Value Normalization Step */}
      {showNormalizationStep && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Step 3: Find Similar Values</h2>
          <div className="mb-4">
            <label className="block mb-2">
              Similarity Threshold: {similarityThreshold}
            </label>
            <input 
              type="range" 
              min="0.1" 
              max="0.9" 
              step="0.1" 
              value={similarityThreshold}
              onChange={(e) => setSimilarityThreshold(parseFloat(e.target.value))}
              className="w-full md:w-64"
            />
          </div>
          
          <div className="bg-gray-100 p-4 rounded">
            <h3 className="font-semibold mb-2">
              Similar Values Found: {similarPairs.length}
            </h3>
            
            {similarPairs.length > 0 && (
              <div className="mb-4 flex gap-2">
                <button 
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                  onClick={() => {
                    applyAllNormalizations();
                    // Show success message
                    alert(`Applied ${similarPairs.length} normalizations based on current threshold of ${similarityThreshold}`);
                  }}
                >
                  Accept All Recommendations
                </button>
                <button
                  className="border border-gray-300 px-4 py-2 rounded hover:bg-gray-100"
                  onClick={() => {
                    setShowNormalizationStep(false);
                    setShowAnalysisStep(true);
                  }}
                >
                  Back to Analysis
                </button>
              </div>
            )}
            
            <div className="max-h-96 overflow-y-auto mb-4">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="p-2 text-left">Value 1</th>
                    <th className="p-2 text-left">Value 2</th>
                    <th className="p-2 text-center">Similarity</th>
                    <th className="p-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {similarPairs.map((pair) => (
                    <tr key={pair.id} className="border-t">
                      <td className="p-2">
                        {pair.value1} ({pair.counts[0]})
                      </td>
                      <td className="p-2">
                        {pair.value2} ({pair.counts[1]})
                      </td>
                      <td className="p-2 text-center">{pair.similarity}</td>
                      <td className="p-2 text-center">
                        {useLookupTable && selectedField === 'Party1 Name' && (
                          <div className="text-sm text-gray-600 mb-2">
                            {(() => {
                              const match1 = findCarrierMatch(pair.value1);
                              const match2 = findCarrierMatch(pair.value2);
                              return (
                                <>
                                  {match1 && <div>Match 1: {match1.Name}</div>}
                                  {match2 && <div>Match 2: {match2.Name}</div>}
                                </>
                              );
                            })()}
                          </div>  
                        )}
                      <td className="p-2 text-center">
                        {editingStates[pair.id] ? (
                          <div className="flex flex-col space-y-2">
                            <input
                              type="text"
                              className="border rounded p-1 w-full"
                              value={customValues[pair.id]}
                              onChange={(e) => updateCustomValue(pair.id, e.target.value)}
                              placeholder="Enter custom value"
                            />
                            <div className="flex justify-center space-x-1">
                              <button
                                className="bg-green-500 text-white px-2 py-1 rounded text-xs hover:bg-green-600"
                                onClick={() => {
                                  applyNormalization(pair, customValues[pair.id]);
                                  toggleEditing(pair.id);
                                }}
                              >
                                Apply
                              </button>
                              <button
                                className="bg-gray-500 text-white px-2 py-1 rounded text-xs hover:bg-gray-600"
                                onClick={() => toggleEditing(pair.id)}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col sm:flex-row space-y-1 sm:space-y-0 sm:space-x-1">
                            <button 
                              className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
                              onClick={() => applyNormalization(pair)}
                            >
                              Normalize to "{pair.targetValue}"
                            </button>
                            <button 
                              className="border border-blue-500 text-blue-500 px-2 py-1 rounded text-sm hover:bg-blue-50"
                              onClick={() => toggleEditing(pair.id)}
                            >
                              Custom
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                    
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Back button when no similar pairs are found */}
            {similarPairs.length === 0 && (
              <div className="mb-4">
                <button
                  className="border border-gray-300 px-4 py-2 rounded hover:bg-gray-100"
                  onClick={() => {
                    setShowNormalizationStep(false);
                    setShowAnalysisStep(true);
                  }}
                >
                  Back to Analysis
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Summary of Changes */}
      {(showAnalysisStep || showNormalizationStep) && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Summary of Changes</h2>
          <div className="bg-gray-100 p-4 rounded">
            {Object.keys(changesMap).length === 0 ? (
              <p>No normalizations applied yet.</p>
            ) : (
              <div>
                {Object.keys(changesMap).map(field => (
                  <div key={field} className="mb-4">
                    <h3 className="font-semibold">{field}</h3>
                    <ul className="list-disc pl-6">
                      {Object.entries(changesMap[field]).map(([source, target], idx) => (
                        <li key={idx}>
                          "{source}" → "{target}"
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                
                <div className="flex flex-wrap gap-2 mt-4">
                  <button 
                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                    onClick={() => {
                      // Use a direct download with a specific filename
                      const defaultName = 'normalized_contract_data.csv';
                      setFileName(defaultName);
                      exportNormalizedCSV(defaultName);
                    }}
                  >
                    Export Normalized CSV
                  </button>
                  <button
                    className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600"
                    onClick={() => {
                      // Generate CSV content
                      const csv = Papa.unparse(normalizedData);
                      
                      // Create a text area to show the data
                      const textArea = document.createElement('textarea');
                      textArea.value = csv;
                      textArea.style.width = '90%';
                      textArea.style.height = '300px';
                      textArea.style.margin = '20px auto';
                      textArea.style.display = 'block';
                      textArea.style.padding = '10px';
                      textArea.style.fontFamily = 'monospace';
                      
                      // Create a modal div
                      const modalDiv = document.createElement('div');
                      modalDiv.style.position = 'fixed';
                      modalDiv.style.top = '0';
                      modalDiv.style.left = '0';
                      modalDiv.style.width = '100%';
                      modalDiv.style.height = '100%';
                      modalDiv.style.backgroundColor = 'rgba(0,0,0,0.7)';
                      modalDiv.style.zIndex = '9999';
                      modalDiv.style.display = 'flex';
                      modalDiv.style.flexDirection = 'column';
                      modalDiv.style.alignItems = 'center';
                      modalDiv.style.justifyContent = 'center';
                      
                      // Create a content div
                      const contentDiv = document.createElement('div');
                      contentDiv.style.backgroundColor = 'white';
                      contentDiv.style.padding = '20px';
                      contentDiv.style.borderRadius = '8px';
                      contentDiv.style.width = '80%';
                      contentDiv.style.maxWidth = '800px';
                      contentDiv.style.maxHeight = '80%';
                      contentDiv.style.overflow = 'auto';
                      
                      // Create a title
                      const titleDiv = document.createElement('h3');
                      titleDiv.textContent = 'Copy and Save CSV Data';
                      titleDiv.style.marginBottom = '15px';
                      
                      // Create instructions
                      const instructions = document.createElement('p');
                      instructions.innerHTML = '1. Select all text below (Ctrl+A/Cmd+A)<br>2. Copy it to clipboard (Ctrl+C/Cmd+C)<br>3. Paste into a text editor<br>4. Save with a .csv extension';
                      instructions.style.marginBottom = '15px';
                      
                      // Create a close button
                      const closeButton = document.createElement('button');
                      closeButton.textContent = 'Close';
                      closeButton.style.padding = '8px 16px';
                      closeButton.style.backgroundColor = '#f44336';
                      closeButton.style.color = 'white';
                      closeButton.style.border = 'none';
                      closeButton.style.borderRadius = '4px';
                      closeButton.style.cursor = 'pointer';
                      closeButton.style.marginTop = '15px';
                      
                      // Add event listener to close button
                      closeButton.addEventListener('click', () => {
                        document.body.removeChild(modalDiv);
                      });
                      
                      // Assemble the modal
                      contentDiv.appendChild(titleDiv);
                      contentDiv.appendChild(instructions);
                      contentDiv.appendChild(textArea);
                      contentDiv.appendChild(closeButton);
                      modalDiv.appendChild(contentDiv);
                      document.body.appendChild(modalDiv);
                      
                      // Select all text in the textarea
                      textArea.focus();
                      textArea.select();
                    }}
                  >
                    View & Copy CSV Data
                  </button>
                  {showNormalizationStep && (
                    <button
                      className="border border-gray-300 px-4 py-2 rounded hover:bg-gray-100"
                      onClick={() => {
                        setShowNormalizationStep(false);
                        setShowAnalysisStep(true);
                      }}
                    >
                      Back to Analysis
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DataNormalizer;
