import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Check, X, AlertCircle, ArrowUpDown, Zap } from 'lucide-react';
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import "./ResizablePanels.css";

const ResizeHandle = () => (
  <PanelResizeHandle className="resize-handle">
    <div className="handle-bar"></div>
  </PanelResizeHandle>
);

const ContractReviewApp = () => {
  // State for responsive behavior
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

  // Update isMobile state on window resize
  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sample standardized lookup lists
  const [standardLists, setStandardLists] = useState({
    party1Names: [
      'Distributed Computing, Inc. dba Ten4',
      'Distributed Computing, Inc.',
      'Ten4 Communications',
      'Ten4 Systems, LLC'
    ],
    party2Names: [
      'Pediatric Eye Care of Maryland',
      'Pediatric Eye Care, LLC',
      'PEC of Maryland',
      'Maryland Eye Care Pediatrics'
    ],
    serviceTypes: [
      'Hosted Voice & Fax Solutions',
      'Voice Services',
      'Fax Services',
      'Sierra Wireless Fixed Cellular (Internet Access)',
      'Internet Access',
      'Fixed Cellular',
      'Wireless Internet'
    ]
  });
  
  // Contract processing statistics
  const [stats, setStats] = useState({
    totalReviewed: 1325,
    pendingReview: 458,
    needsCorrection: 132,
    completedToday: 47
  });

  // Field normalization status
  const [normalizationStatus, setNormalizationStatus] = useState({
    party1Name: 'unverified', // unverified, normalized, mismatch
    party2Name: 'mismatch',
    services: 'unverified'
  });

  // Sample extracted data from the contract (matches the sample images)
  const [extractedData, setExtractedData] = useState({
    agreementDate: '6/--/2020',
    party1Name: 'Distributed Computing, Inc. dba Ten4',
    party2Name: 'Pediatric Eye Care of Maryland',
    term: '36',
    renewalTerm: '1',
    monthlyRecurringCharges: '498.95',
    nonRecurringCharges: '424.95',
    services: [
      'Hosted Voice & Fax Solutions',
      'Sierra Wireless Fixed Cellular (Internet Access)'
    ],
    locations: '2 Hamill Road, Suite 345, Baltimore, MD 21210'
  });

  // Track the currently selected field for editing
  const [selectedField, setSelectedField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [activeTab, setActiveTab] = useState('pdf');

  // Handle field edit
  const startEdit = (field, value) => {
    setSelectedField(field);
    setEditValue(Array.isArray(value) ? value.join("\n") : value);
  };

  // Save edited field
  const saveEdit = () => {
    if (selectedField === 'services') {
      // Split services by newline and trim each service
      const services = editValue.split('\n').map(s => s.trim()).filter(s => s);
      setExtractedData(prev => ({
        ...prev,
        [selectedField]: services
      }));
    } else {
      setExtractedData(prev => ({
        ...prev,
        [selectedField]: editValue
      }));
    }
    setSelectedField(null);
    
    // Update normalization status for the field if it's a standardizable field
    if (['party1Name', 'party2Name', 'services'].includes(selectedField)) {
      const newValue = selectedField === 'services' 
        ? editValue.split('\n').map(s => s.trim()).filter(s => s)
        : editValue;
      
      setNormalizationStatus(prev => ({
        ...prev,
        [selectedField]: getStandardizationStatus(selectedField, newValue)
      }));
    }
  };

  // Cancel edit
  const cancelEdit = () => {
    setSelectedField(null);
  };

  // Check if a field value exists in the standard list
  const getStandardizationStatus = (field, value) => {
    if (field === 'party1Name') {
      return standardLists.party1Names.includes(value) ? 'normalized' : 'mismatch';
    } else if (field === 'party2Name') {
      return standardLists.party2Names.includes(value) ? 'normalized' : 'mismatch';
    } else if (field === 'services') {
      // For services (which is an array), check if all items are in the standard list
      const serviceArray = Array.isArray(value) ? value : value.split('\n');
      return serviceArray.every(service => standardLists.serviceTypes.includes(service)) 
        ? 'normalized' 
        : 'mismatch';
    }
    return 'unverified';
  };

  // Normalize a field to standard value
  const normalizeField = (field) => {
    if (field === 'party1Name') {
      // Find closest match in standard list
      const closestMatch = findClosestMatch(extractedData.party1Name, standardLists.party1Names);
      if (closestMatch) {
        setExtractedData(prev => ({ ...prev, party1Name: closestMatch }));
        setNormalizationStatus(prev => ({ ...prev, party1Name: 'normalized' }));
      }
    } else if (field === 'party2Name') {
      const closestMatch = findClosestMatch(extractedData.party2Name, standardLists.party2Names);
      if (closestMatch) {
        setExtractedData(prev => ({ ...prev, party2Name: closestMatch }));
        setNormalizationStatus(prev => ({ ...prev, party2Name: 'normalized' }));
      }
    } else if (field === 'services') {
      // Normalize each service to closest match
      const services = extractedData.services;
      const normalizedServices = services.map(service => 
        findClosestMatch(service, standardLists.serviceTypes) || service
      );
      
      setExtractedData(prev => ({ ...prev, services: normalizedServices }));
      setNormalizationStatus(prev => ({ 
        ...prev, 
        services: normalizedServices.every(service => 
          standardLists.serviceTypes.includes(service)) ? 'normalized' : 'mismatch' 
      }));
    }
  };

  // Normalize all fields
  const normalizeAllFields = () => {
    normalizeField('party1Name');
    normalizeField('party2Name');
    normalizeField('services');
  };

  // Simple string similarity (could be replaced with more sophisticated algorithm)
  const findClosestMatch = (value, standardList) => {
    if (!value) return null;
    
    // Exact match
    if (standardList.includes(value)) return value;
    
    // Find closest match based on included terms
    const lowerValue = value.toLowerCase();
    for (const standard of standardList) {
      if (lowerValue.includes(standard.toLowerCase()) || 
          standard.toLowerCase().includes(lowerValue)) {
        return standard;
      }
    }
    
    // Default to first item if nothing else matches
    return standardList[0];
  };

  // Add a new standard value to a lookup list
  const addToStandardList = (field, value) => {
    if (!value) return;
    
    if (field === 'party1Name') {
      setStandardLists(prev => ({
        ...prev,
        party1Names: [...prev.party1Names, value]
      }));
      setNormalizationStatus(prev => ({ ...prev, party1Name: 'normalized' }));
    } else if (field === 'party2Name') {
      setStandardLists(prev => ({
        ...prev,
        party2Names: [...prev.party2Names, value]
      }));
      setNormalizationStatus(prev => ({ ...prev, party2Name: 'normalized' }));
    } else if (field === 'services') {
      const servicesArray = Array.isArray(value) ? value : [value];
      setStandardLists(prev => ({
        ...prev,
        serviceTypes: [...prev.serviceTypes, ...servicesArray.filter(s => !prev.serviceTypes.includes(s))]
      }));
      setNormalizationStatus(prev => ({ ...prev, services: 'normalized' }));
    }
  };

  const renderFieldRow = (label, field, value) => {
    const isStandardizableField = ['party1Name', 'party2Name', 'services'].includes(field);
    const status = isStandardizableField ? normalizationStatus[field] : null;
    
    return (
      <tr className="border-b">
        <td className="p-2 font-medium text-gray-700 w-1/3">{label}</td>
        <td className={`p-2 relative ${selectedField === field ? 'bg-blue-50' : ''}`}>
          {selectedField === field ? (
            <div className="flex items-center">
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="flex-1 p-1 border rounded mr-2"
                autoFocus
              />
              <button 
                onClick={saveEdit} 
                className="p-1 bg-green-500 text-white rounded mr-1"
                title="Save"
              >
                <Check size={16} />
              </button>
              <button 
                onClick={cancelEdit} 
                className="p-1 bg-red-500 text-white rounded"
                title="Cancel"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div 
                className={`p-1 hover:bg-gray-100 rounded cursor-pointer flex-grow ${
                  status === 'mismatch' ? 'border-l-4 border-amber-500 pl-2' : ''
                }`}
                onClick={() => startEdit(field, value)}
              >
                {Array.isArray(value) ? value.join(", ") : value}
              </div>
              
              {isStandardizableField && (
                <div className="flex items-center ml-2">
                  {status === 'mismatch' && (
                    <button 
                      onClick={() => normalizeField(field)}
                      className="p-1 text-blue-600 hover:text-blue-800"
                      title="Normalize to standard value"
                    >
                      <Zap size={16} />
                    </button>
                  )}
                  <button 
                    onClick={() => addToStandardList(field, Array.isArray(value) ? value : [value])}
                    className="p-1 text-green-600 hover:text-green-800"
                    title="Add to standard list"
                  >
                    <Check size={16} />
                  </button>
                </div>
              )}
            </div>
          )}
          
          {status === 'mismatch' && !selectedField && (
            <div className="text-xs text-amber-600 flex items-center mt-1">
              <AlertCircle size={12} className="mr-1" /> Value not in standard list
            </div>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="w-full bg-gray-50 min-h-screen">
      {/* Header */}
      <header className="flex justify-between items-center bg-blue-800 text-white p-2 sm:p-4 rounded-t">
        <div className="text-lg sm:text-xl font-bold">acretiv - extractor</div>
      </header>

      {/* Main content */}
      <PanelGroup direction="horizontal" className="panel-group">
        <Panel defaultSize={50} minSize={30}>
          <div className="p-4 border-t sm:border-t-0 sm:border-r">
            <div className="bg-white rounded p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Contract Details</h2>
                <button 
                  onClick={normalizeAllFields}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                >
                  <Zap size={16} /> Normalize All Fields
                </button>
              </div>

              {/* Contract processing stats */}
              <div className="bg-gray-50 p-3 mb-4 rounded grid grid-cols-4 gap-2 text-center">
                <div>
                  <div className="text-xs text-gray-500">Reviewed</div>
                  <div className="font-bold text-blue-700">{stats.totalReviewed}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Pending</div>
                  <div className="font-bold text-amber-600">{stats.pendingReview}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Need Correction</div>
                  <div className="font-bold text-red-600">{stats.needsCorrection}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Today</div>
                  <div className="font-bold text-green-600">{stats.completedToday}</div>
                </div>
              </div>

              {/* All content in a single view */}
              <div className="mb-6">
                <table className="w-full border-collapse">
                  <tbody>
                    {renderFieldRow("Agreement Date", "agreementDate", extractedData.agreementDate)}
                    {renderFieldRow("Party 1 Name", "party1Name", extractedData.party1Name)}
                    {renderFieldRow("Party 2 Name", "party2Name", extractedData.party2Name)}
                    {renderFieldRow("Term", "term", extractedData.term)}
                    {renderFieldRow("Renewal Term", "renewalTerm", extractedData.renewalTerm)}
                    {renderFieldRow("Monthly Recurring Charges", "monthlyRecurringCharges", extractedData.monthlyRecurringCharges)}
                    {renderFieldRow("Non-Recurring Charges", "nonRecurringCharges", extractedData.nonRecurringCharges)}
                    {renderFieldRow("Services", "services", extractedData.services)}
                    {renderFieldRow("Locations", "locations", extractedData.locations)}
                  </tbody>
                </table>
              </div>

              {/* Standard Lists Management (collapsible) */}
              <div className="mb-4 border rounded">
                <div className="p-2 bg-gray-100 font-medium flex justify-between items-center cursor-pointer">
                  <span>Standard Value Lists</span>
                  <ArrowUpDown size={16} />
                </div>
                <div className="p-3 text-sm">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Party 1 Names */}
                    <div>
                      <h4 className="font-medium mb-1">Party 1 Names</h4>
                      <div className="max-h-32 overflow-y-auto bg-gray-50 p-2 rounded text-xs">
                        {standardLists.party1Names.map((name, i) => (
                          <div key={`p1-${i}`} className="mb-1 p-1 hover:bg-gray-100">{name}</div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Party 2 Names */}
                    <div>
                      <h4 className="font-medium mb-1">Party 2 Names</h4>
                      <div className="max-h-32 overflow-y-auto bg-gray-50 p-2 rounded text-xs">
                        {standardLists.party2Names.map((name, i) => (
                          <div key={`p2-${i}`} className="mb-1 p-1 hover:bg-gray-100">{name}</div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Service Types */}
                    <div>
                      <h4 className="font-medium mb-1">Service Types</h4>
                      <div className="max-h-32 overflow-y-auto bg-gray-50 p-2 rounded text-xs">
                        {standardLists.serviceTypes.map((service, i) => (
                          <div key={`svc-${i}`} className="mb-1 p-1 hover:bg-gray-100">{service}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex justify-between">
                <button className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">
                  Cancel
                </button>
                
                <div className="flex gap-2">
                  <button className="px-4 py-2 border border-blue-600 text-blue-600 rounded hover:bg-blue-50">
                    Skip
                  </button>
                  <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                    Update
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Panel>

        <ResizeHandle />

        <Panel defaultSize={50} minSize={30}>
          <div className="p-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="bg-gray-100 mb-4">
                <TabsTrigger value="pdf">PDF</TabsTrigger>
                <TabsTrigger value="text">Text</TabsTrigger>
              </TabsList>
              
              <TabsContent value="pdf" className="p-4 bg-gray-100 rounded min-h-[500px] sm:min-h-[600px]">
                <div className="border bg-white p-4 min-h-[500px] sm:min-h-[600px] flex items-center justify-center text-center">
                  <div>
                    <img src="/api/placeholder/400/550" alt="Contract PDF Preview" className="mx-auto mb-4" />
                    <p className="text-gray-500">PDF viewer would display the contract document here</p>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="text" className="p-4 bg-gray-100 rounded min-h-[500px] sm:min-h-[600px]">
                <div className="border bg-white p-4 min-h-[500px] sm:min-h-[600px] text-sm font-mono overflow-auto">
                  <p>ADDENDUM to Master Services Agreement</p>
                  <p>MULTIPLE SERVICES</p>
                  <p>Customer Legal Name: Pediatric Eye Care of Maryland</p>
                  <p>Billing Address: 2 Hamill Road, Suite 345, Baltimore, MD 21210</p>
                  <p>Billing Contact and e-mail Address: Chippy Weiner, chippydea2004@yahoo.com</p>
                  <p>Service Location Address: </p>
                  <p>As of the 17 day of June, 2020 (Effective Date), Ten4 and Customer enter into this Contract and, in addition to the contents herein, agree to be bound by Ten4's Standard Terms and Conditions, which can be found at www.ten4.us/T&C and which are incorporated herein and constitute part of this Contract.</p>
                  <p>...</p>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
};

export default ContractReviewApp;