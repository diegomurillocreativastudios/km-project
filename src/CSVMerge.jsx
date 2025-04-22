import React, { useState } from 'react';
import {
  Upload,
  Download,
  Database,
  ArrowRight,
  Plus,
  Trash2,
  Save,
  FileSpreadsheet,
  Edit,
  AlertTriangle
} from 'lucide-react';
import Papa from 'papaparse';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { 
  SortableContext, 
  verticalListSortingStrategy,
  useSortable,
  arrayMove 
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const CSVMerge = () => {
  // State management
  const [sources, setSources] = useState([]);
  const [repository, setRepository] = useState([]);
  const [currentSource, setCurrentSource] = useState(null);
  const [sourceData, setSourceData] = useState([]);
  const [repositoryFields, setRepositoryFields] = useState([]);
  const [newMappingName, setNewMappingName] = useState('');
  const [repositoryName, setRepositoryName] = useState('Combined Repository');
  const [notification, setNotification] = useState({ show: false, message: '', type: 'info' });
  const [showRepository, setShowRepository] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState({
    show: false,
    title: '',
    message: '',
    onConfirm: () => {},
    onCancel: () => {}
  });
  const [activeView, setActiveView] = useState('sources'); // 'sources' or 'repository'
  const [sourceSort, setSourceSort] = useState({ column: null, direction: 'asc' });
  const [repoSort, setRepoSort] = useState({ column: null, direction: 'asc' });
  const [showFieldMapping, setShowFieldMapping] = useState(true);
  const [sourceDescription, setSourceDescription] = useState('');
  const [sourcePage, setSourcePage] = useState(0);
  const [repoPage, setRepoPage] = useState(0);
  const rowsPerPage = 10; // Number of rows per page

  // Helper to read file as text
  const readFileAsText = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e.target.error);
      reader.readAsText(file);
    });

  // Notification helper
  const showNotification = (message, type = 'info') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: 'info' }), 5000);
  };

  // Export repository as CSV
  const exportRepository = () => {
    if (repository.length === 0) {
      showNotification('Repository is empty', 'error');
      return;
    }
    const csv = Papa.unparse(repository);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${repositoryName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification('Repository exported successfully', 'success');
  };

  // Update the handleFileUpload function
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const content = await readFileAsText(file);
      Papa.parse(content, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        complete: (results) => {
          const newSource = {
            id: Date.now(),
            name: file.name,
            fields: results.meta.fields || [],
            data: results.data,
            mappings: {},
            merged: false // Initialize merged flag
          };
          setSources((prev) => [...prev, newSource]);
          setCurrentSource(newSource);
          setSourceData(results.data);
          showNotification(
            `File "${file.name}" loaded successfully with ${results.data.length} rows`,
            'success'
          );
        },
        error: (err) => {
          showNotification(`Error parsing CSV: ${err.message}`, 'error');
        }
      });
    } catch (err) {
      showNotification(`Error reading file: ${err.message}`, 'error');
    }
  };

  // Update field mapping for current source
  const updateMapping = (sourceField, repositoryField) => {
    if (!currentSource) return;
    setSources((prev) =>
      prev.map((src) =>
        src.id === currentSource.id
          ? { ...src, mappings: { ...src.mappings, [sourceField]: repositoryField } }
          : src
      )
    );
    setCurrentSource((prev) =>
      prev && { ...prev, mappings: { ...prev.mappings, [sourceField]: repositoryField } }
    );
  };

  // Add a new repository field
  const addRepositoryField = () => {
    if (!newMappingName.trim() || repositoryFields.includes(newMappingName)) {
      showNotification('Please enter a unique field name', 'error');
      return;
    }
    setRepositoryFields((prev) => [...prev, newMappingName]);
    setNewMappingName('');
  };

  // Merge data into repository
  const mergeIntoRepository = () => {
    if (!currentSource) return;
    const mappings = currentSource.mappings;
    if (!Object.values(mappings).some((m) => m)) {
      showNotification('Please map at least one field before merging', 'error');
      return;
    }

    // Check if source is already merged
    if (currentSource.merged) {
      setShowConfirmDialog({
        show: true,
        title: 'Warning: Data Already Merged',
        message: 'This data source has already been merged. Merging again will create duplicate records. Do you want to continue?',
        onConfirm: () => {
          performMerge();
          setShowConfirmDialog((s) => ({ ...s, show: false }));
        },
        onCancel: () => {
          setShowConfirmDialog((s) => ({ ...s, show: false }));
        }
      });
      return;
    }

    performMerge();
  };

  // Add the performMerge helper function
  const performMerge = () => {
    const newData = currentSource.data.map((row) => {
      const repoRow = {};
      Object.entries(currentSource.mappings).forEach(([srcField, repoField]) => {
        if (repoField && row[srcField] !== undefined) {
          repoRow[repoField] = row[srcField];
        }
      });
      return repoRow;
    });

    setRepository((prev) => [...prev, ...newData]);
    
    // Mark the source as merged
    setSources((prev) =>
      prev.map((src) =>
        src.id === currentSource.id ? { ...src, merged: true } : src
      )
    );
    setCurrentSource((prev) => ({ ...prev, merged: true }));
    
    showNotification(`Added ${newData.length} rows to repository`, 'success');
  };

  // Save project as JSON
  const saveProject = () => {
    try {
      const projectData = {
        name: repositoryName,
        sources: sources.map((src) => ({
          id: src.id,
          name: src.name,
          fields: src.fields,
          mappings: src.mappings,
          data: src.data
        })),
        repository,
        repositoryFields,
        timestamp: new Date().toISOString()
      };
      const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${repositoryName.replace(/\s+/g, '_')}_project.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showNotification('Project saved successfully', 'success');
    } catch (err) {
      showNotification(`Error saving project: ${err.message}`, 'error');
    }
  };

  // Load project from JSON
  const loadProject = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const content = await readFileAsText(file);
      const projectData = JSON.parse(content);
      if (!projectData.sources || !projectData.repositoryFields || !projectData.repository) {
        showNotification('Invalid project file format', 'error');
        return;
      }
      setRepositoryName(projectData.name || 'Combined Repository');
      setSources(projectData.sources);
      setRepositoryFields(projectData.repositoryFields);
      setRepository(projectData.repository);
      setCurrentSource(projectData.sources[0] || null);
      setSourceData(projectData.sources[0]?.data || []);
      setSourcePage(0);
      setRepoPage(0);
      showNotification('Project loaded successfully', 'success');
    } catch (err) {
      showNotification(`Error loading project: ${err.message}`, 'error');
    }
  };

  // Switch between sources
  const switchSource = (source) => {
    setCurrentSource(source);
    setSourceData(source.data);
    setSourcePage(0);
  };

  // Remove a source
  const removeSource = (id) => {
    setSources((prev) => prev.filter((src) => src.id !== id));
    if (currentSource?.id === id) {
      setCurrentSource(null);
      setSourceData([]);
    }
  };

  // Remove a repository field
  const removeRepositoryField = (field) => {
    setRepositoryFields((prev) => prev.filter((f) => f !== field));
    setSources((prev) =>
      prev.map((src) => {
        const mappings = { ...src.mappings };
        Object.keys(mappings).forEach((sf) => {
          if (mappings[sf] === field) mappings[sf] = '';
        });
        return { ...src, mappings };
      })
    );
    if (currentSource) {
      const mappings = { ...currentSource.mappings };
      Object.keys(mappings).forEach((sf) => {
        if (mappings[sf] === field) mappings[sf] = '';
      });
      setCurrentSource((prev) => ({ ...prev, mappings }));
    }
  };

  // Clear entire repository with confirmation
  const clearRepository = () => {
    setShowConfirmDialog({
      show: true,
      title: 'Clear Repository',
      message: 'Are you sure you want to clear the repository? This action cannot be undone.',
      onConfirm: () => {
        setRepository([]);
        setRepoPage(0);
        showNotification('Repository cleared', 'info');
        setShowConfirmDialog((s) => ({ ...s, show: false }));
      },
      onCancel: () => {
        setShowConfirmDialog((s) => ({ ...s, show: false }));
      }
    });
  };

  // Toggle view between sources and repository
  const toggleView = (view) => {
    setActiveView(view);
    setShowRepository(view === 'repository');
  };

  const sortData = (data, column, direction) => {
    if (!column) return data;
  
    return [...data].sort((a, b) => {
      if (a[column] === undefined || b[column] === undefined) return 0;
  
      if (a[column] < b[column]) return direction === 'asc' ? -1 : 1;
      if (a[column] > b[column]) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const renameRepositoryField = (oldFieldName, newFieldName) => {
    if (!newFieldName.trim() || repositoryFields.includes(newFieldName)) {
      showNotification('Please enter a unique field name', 'error');
      return;
    }
  
    // Update repository fields
    setRepositoryFields((prev) =>
      prev.map((field) => (field === oldFieldName ? newFieldName : field))
    );
  
    // Update mappings in all sources
    setSources((prev) =>
      prev.map((src) => {
        const mappings = { ...src.mappings };
        Object.keys(mappings).forEach((sf) => {
          if (mappings[sf] === oldFieldName) mappings[sf] = newFieldName;
        });
        return { ...src, mappings };
      })
    );
  
    // Update current source mappings
    if (currentSource) {
      const mappings = { ...currentSource.mappings };
      Object.keys(mappings).forEach((sf) => {
        if (mappings[sf] === oldFieldName) mappings[sf] = newFieldName;
      });
      setCurrentSource((prev) => ({ ...prev, mappings }));
    }
  
    // Update repository data
    setRepository((prev) =>
      prev.map((row) => {
        const updatedRow = { ...row };
        if (oldFieldName in updatedRow) {
          updatedRow[newFieldName] = updatedRow[oldFieldName];
          delete updatedRow[oldFieldName];
        }
        return updatedRow;
      })
    );
  
    showNotification(`Field "${oldFieldName}" renamed to "${newFieldName}"`, 'success');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-blue-600 text-white p-4 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">CSV Data Aggregator</h1>
          <p className="text-sm">Import, map, and aggregate data from multiple CSV sources</p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={saveProject}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded flex items-center"
          >
            <Save size={16} className="mr-2" /> Save Project
          </button>
          <label className="cursor-pointer bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded flex items-center">
            <input type="file" accept=".json" className="hidden" onChange={loadProject} />
            <Upload size={16} className="mr-2" /> Load Project
          </label>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar - Sources */}
        <div className="w-64 bg-gray-100 p-4 overflow-y-auto flex flex-col">
          {/* Left sidebar header */}
          <h2 
            className={`font-bold mb-2 flex items-center cursor-pointer ${
              activeView === 'sources' ? 'text-blue-600' : ''
            }`}
            onClick={() => toggleView('sources')}
          >
            <FileSpreadsheet size={16} className="mr-2" /> 
            <span className={`border-b-2 ${
              activeView === 'sources' ? 'border-blue-600' : 'border-transparent'
            }`}>
              Data Sources
            </span>
          </h2>
          <div className="flex-1 overflow-y-auto mb-4">
            {sources.length === 0 ? (
              <div className="text-gray-500 text-sm p-2 bg-white rounded">
                No sources added yet. Upload a CSV file to get started.
              </div>
            ) : (
              sources.map((source) => (
                <div
                  key={source.id}
                  onClick={() => switchSource(source)}
                  className={`p-2 rounded mb-2 flex justify-between items-center cursor-pointer 
                    ${currentSource?.id === source.id
                      ? 'bg-blue-100 border border-blue-300'
                      : source.merged
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-white'
                    }`}
                >
                  <div className="truncate flex-1">
                    <div className="font-medium text-sm flex items-center">
                      {source.name}
                      {source.merged && (
                        <span className="ml-2 text-xs px-2 py-0.5 bg-green-100 text-green-800 rounded-full">
                          Merged
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">{source.data.length} rows</div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSource(source.id);
                    }}
                    className="text-red-500 hover:bg-red-50 p-1 rounded"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
          <label className="block w-full cursor-pointer text-center px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
            <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
            <Upload size={16} className="inline mr-2" /> Upload CSV
          </label>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Field Mapping */}
          <div className="p-4 border-b">
            <div className="flex justify-between items-center">
              <h2 className="font-bold mb-4">Field Mapping</h2>
              <button
                onClick={() => setShowFieldMapping((prev) => !prev)}
                className="text-sm text-blue-600 hover:underline"
              >
                {showFieldMapping ? 'Hide' : 'Show'}
              </button>
            </div>
            {showFieldMapping && (
              currentSource ? (
                <div className="grid grid-cols-3 gap-4">
                  {/* Source Fields */}
                  <div>
                    <h3 className="font-bold text-sm mb-2">Source Fields</h3>
                    <div className="bg-gray-50 p-2 rounded max-h-40 overflow-y-auto">
                      {currentSource.fields.map((field) => (
                        <div key={field} className="mb-2">
                          <div className="mb-1">{field}</div>
                          <select
                            className="w-full p-1 border rounded text-sm"
                            value={currentSource.mappings[field] || ''}
                            onChange={(e) => updateMapping(field, e.target.value)}
                          >
                            <option value="">Not mapped</option>
                            {repositoryFields.map((repoField) => (
                              <option key={repoField} value={repoField}>
                                {repoField}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Merge Button */}
                  <div className="flex items-center justify-center">
                    <div className="flex flex-col items-center">
                      <ArrowRight size={24} className="text-blue-500" />
                      <button
                        onClick={mergeIntoRepository}
                        className={`mt-2 px-3 py-1 rounded text-sm flex items-center ${
                          currentSource?.merged
                            ? 'bg-yellow-500 hover:bg-yellow-600'
                            : 'bg-green-500 hover:bg-green-600'
                        } text-white`}
                      >
                        {currentSource?.merged && (
                          <AlertTriangle size={14} className="mr-1" />
                        )}
                        Merge Data
                      </button>
                    </div>
                  </div>

                  {/* Repository Fields */}
                  <div>
                    <h3 className="font-bold text-sm mb-2">Repository Fields</h3>
                    <RepositoryFields
                      repositoryFields={repositoryFields}
                      setRepositoryFields={setRepositoryFields}
                      removeRepositoryField={removeRepositoryField}
                      renameRepositoryField={renameRepositoryField} // Pass the function here
                    />
                  </div>
                </div>
              ) : (
                <div className="text-gray-500 text-center py-4">Select a source to configure mapping</div>
              )
            )}
          </div>

          {/* Data Preview & Pagination */}
          <div className="flex-1 overflow-auto p-4">
            {activeView === 'sources' ? (
              currentSource && sourceData.length > 0 ? (
                <div className="overflow-x-auto">
                  {/* Source table content */}
                  <table className="min-w-full border bg-white">
                    <thead>
                      <tr className="bg-gray-100">
                        {currentSource.fields.map((field) => (
                          <th
                            key={field}
                            onClick={() => {
                              const isAsc = sourceSort.column === field && sourceSort.direction === 'asc';
                              setSourceSort({ column: field, direction: isAsc ? 'desc' : 'asc' });
                            }}
                            className={`px-4 py-2 text-left text-xs font-medium uppercase tracking-wider border-r cursor-pointer ${
                              repositoryFields.includes(currentSource.mappings[field])
                                ? 'text-blue-600' // Highlight in blue if mapped
                                : 'text-gray-500' // Default gray text
                            }`}
                          >
                            {field}
                            {sourceSort.column === field && (
                              <span className="ml-1">{sourceSort.direction === 'asc' ? '▲' : '▼'}</span>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortData(
                        sourceData,
                        sourceSort.column,
                        sourceSort.direction
                      )
                        .slice(sourcePage * rowsPerPage, (sourcePage + 1) * rowsPerPage)
                        .map((row, i) => (
                          <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            {currentSource.fields.map((field) => (
                              <td key={field} className="px-4 py-2 border-r text-sm">
                                {row[field] != null ? String(row[field]) : ''}
                              </td>
                            ))}
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  {/* Pagination Controls */}
                  <div className="flex justify-between items-center mt-4">
                    <button
                      onClick={() => setSourcePage(0)}
                      disabled={sourcePage === 0}
                      className={`px-3 py-1 rounded text-sm border ${
                        sourcePage > 0 ? 'bg-blue-50 text-blue-600 hover:bg-blue-100' : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      First
                    </button>
                    <button
                      onClick={() => setSourcePage((prev) => Math.max(0, prev - 1))}
                      disabled={sourcePage === 0}
                      className={`px-3 py-1 rounded text-sm border ${
                        sourcePage > 0 ? 'bg-blue-50 text-blue-600 hover:bg-blue-100' : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      Prev
                    </button>
                    <span className="text-sm">
                      Page {sourcePage + 1} of {Math.ceil(sourceData.length / rowsPerPage)}
                    </span>
                    <button
                      onClick={() => setSourcePage((prev) => Math.min(prev + 1, Math.ceil(sourceData.length / rowsPerPage) - 1))}
                      disabled={(sourcePage + 1) * rowsPerPage >= sourceData.length}
                      className={`px-3 py-1 rounded text-sm border ${
                        (sourcePage + 1) * rowsPerPage < sourceData.length
                          ? 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                          : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      Next
                    </button>
                    <button
                      onClick={() => setSourcePage(Math.ceil(sourceData.length / rowsPerPage) - 1)}
                      disabled={(sourcePage + 1) * rowsPerPage >= sourceData.length}
                      className={`px-3 py-1 rounded text-sm border ${
                        (sourcePage + 1) * rowsPerPage < sourceData.length
                          ? 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                          : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      Last
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-gray-500 text-center py-4">
                  {currentSource ? 'No data available in this source' : 'Select a source to preview data'}
                </div>
              )
            ) : (
              // Repository view
              repository.length > 0 ? (
                <div className="overflow-x-auto">
                  {/* Repository table content */}
                  <table className="min-w-full border bg-white">
                    <thead>
                      <tr className="bg-gray-100">
                        {repositoryFields.map((field) => (
                          <th
                            key={field}
                            onClick={() => {
                              const isAsc = repoSort.column === field && repoSort.direction === 'asc';
                              setRepoSort({ column: field, direction: isAsc ? 'desc' : 'asc' });
                            }}
                            className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r cursor-pointer"
                          >
                            {field}
                            {repoSort.column === field && (
                              <span className="ml-1">{repoSort.direction === 'asc' ? '▲' : '▼'}</span>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortData(
                        repository,
                        repoSort.column,
                        repoSort.direction
                      )
                        .slice(repoPage * rowsPerPage, (repoPage + 1) * rowsPerPage)
                        .map((row, i) => (
                          <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            {repositoryFields.map((field) => (
                              <td key={field} className="px-4 py-2 border-r text-sm">
                                {row[field] != null ? String(row[field]) : ''}
                              </td>
                            ))}
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  {/* Pagination Controls */}
                  <div className="flex justify-between items-center mt-4">
                    <button
                      onClick={() => setRepoPage(0)}
                      disabled={repoPage === 0}
                      className={`px-3 py-1 rounded text-sm border ${
                        repoPage > 0 ? 'bg-blue-50 text-blue-600 hover:bg-blue-100' : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      First
                    </button>
                    <button
                      onClick={() => setRepoPage((prev) => Math.max(0, prev - 1))}
                      disabled={repoPage === 0}
                      className={`px-3 py-1 rounded text-sm border ${
                        repoPage > 0 ? 'bg-blue-50 text-blue-600 hover:bg-blue-100' : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      Prev
                    </button>
                    <span className="text-sm">
                      Page {repoPage + 1} of {Math.ceil(repository.length / rowsPerPage)}
                    </span>
                    <button
                      onClick={() => setRepoPage((prev) => Math.min(prev + 1, Math.ceil(repository.length / rowsPerPage) - 1))}
                      disabled={(repoPage + 1) * rowsPerPage >= repository.length}
                      className={`px-3 py-1 rounded text-sm border ${
                        (repoPage + 1) * rowsPerPage < repository.length
                          ? 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                          : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      Next
                    </button>
                    <button
                      onClick={() => setRepoPage(Math.ceil(repository.length / rowsPerPage) - 1)}
                      disabled={(repoPage + 1) * rowsPerPage >= repository.length}
                      className={`px-3 py-1 rounded text-sm border ${
                        (repoPage + 1) * rowsPerPage < repository.length
                          ? 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                          : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      Last
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-gray-500 text-center py-4">
                  Repository is empty. Map and merge data to populate it.
                </div>
              )
            )}
          </div>
        </div>

        {/* Right sidebar - Repository controls */}
        <div className="w-64 bg-gray-100 p-4 overflow-y-auto flex flex-col">
          {/* Right sidebar header */}
          <h2 
            className={`font-bold mb-2 flex items-center cursor-pointer ${
              activeView === 'repository' ? 'text-blue-600' : ''
            }`}
            onClick={() => toggleView('repository')}
          >
            <Database size={16} className="mr-2" /> 
            <span className={`border-b-2 ${
              activeView === 'repository' ? 'border-blue-600' : 'border-transparent'
            }`}>
              Repository
            </span>
          </h2>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Repository Name</label>
            <input
              type="text"
              className="w-full p-2 border rounded"
              value={repositoryName}
              onChange={(e) => setRepositoryName(e.target.value)}
            />
          </div>
          <div className="bg-white rounded p-2 mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Records</span>
              <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                {repository.length}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Fields</span>
              <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                {repositoryFields.length}
              </span>
            </div>
          </div>
          <div className="mt-auto flex flex-col gap-2">
            <button
              onClick={exportRepository}
              disabled={repository.length === 0}
              className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 flex items-center justify-center"
            >
              <Download size={16} className="mr-2" /> Export Repository
            </button>
            <button
              onClick={clearRepository}
              className="w-full px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 flex items-center justify-center"
            >
              <Trash2 size={16} className="mr-2" /> Clear Repository
            </button>
          </div>
        </div>
      </div>

      {/* Notification */}
      {notification.show && (
        <div
          className={`fixed bottom-4 right-4 p-4 rounded shadow-lg max-w-md ${
            notification.type === 'error'
              ? 'bg-red-100 text-red-800'
              : notification.type === 'success'
              ? 'bg-green-100 text-green-800'
              : 'bg-blue-100 text-blue-800'
          }`}
        >
          {notification.message}
        </div>
      )}

      {/* Confirmation Dialog */}
      {showConfirmDialog.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-2">{showConfirmDialog.title}</h3>
            <p className="mb-4">{showConfirmDialog.message}</p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={showConfirmDialog.onCancel}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={showConfirmDialog.onConfirm}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const RepositoryFields = ({ repositoryFields, setRepositoryFields, removeRepositoryField, renameRepositoryField }) => {
  const [newFieldName, setNewFieldName] = useState('');

  const handleAddField = () => {
    if (!newFieldName.trim() || repositoryFields.includes(newFieldName)) {
      alert('Please enter a unique field name.');
      return;
    }
    setRepositoryFields((prev) => [...prev, newFieldName]);
    setNewFieldName('');
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = repositoryFields.indexOf(active.id);
      const newIndex = repositoryFields.indexOf(over.id);
      setRepositoryFields((fields) => arrayMove(fields, oldIndex, newIndex));
    }
  };

  return (
    <DndContext 
      collisionDetection={closestCenter} 
      onDragEnd={handleDragEnd}
    >
      <div className="bg-gray-50 p-2 rounded mb-2 max-h-40 overflow-y-auto">
        <SortableContext 
          items={repositoryFields}
          strategy={verticalListSortingStrategy}
        >
          {repositoryFields.length === 0 ? (
            <div className="text-gray-500 text-sm">No repository fields yet.</div>
          ) : (
            repositoryFields.map((field) => (
              <DraggableField
                key={field}
                id={field}
                field={field}
                removeRepositoryField={removeRepositoryField}
                renameRepositoryField={renameRepositoryField}
              />
            ))
          )}
        </SortableContext>
      </div>
      <div className="flex items-center mt-2">
        <input
          type="text"
          value={newFieldName}
          onChange={(e) => setNewFieldName(e.target.value)}
          placeholder="Enter field name"
          className="flex-1 p-2 border rounded text-sm"
        />
        <button
          onClick={handleAddField}
          className="ml-2 px-4 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
        >
          Add Field
        </button>
      </div>
    </DndContext>
  );
};

const DraggableField = ({ id, field, removeRepositoryField, renameRepositoryField }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: field });

  const [isRenaming, setIsRenaming] = useState(false);
  const [newFieldName, setNewFieldName] = useState(field);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleRename = () => {
    if (newFieldName !== field) {
      renameRepositoryField(field, newFieldName);
    }
    setIsRenaming(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex justify-between items-center mb-1 p-1 hover:bg-gray-100 rounded bg-white border ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <div
        {...attributes}
        {...listeners}
        className="flex-1 cursor-grab"
        title="Drag to reorder"
      >
        {isRenaming ? (
          <input
            type="text"
            value={newFieldName}
            onChange={(e) => setNewFieldName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename();
              if (e.key === 'Escape') setIsRenaming(false);
            }}
            className="w-full p-1 border rounded text-sm"
          />
        ) : (
          <span>{field}</span>
        )}
      </div>
      <div className="flex items-center space-x-2">
        <button
          onClick={() => setIsRenaming(true)}
          className="text-blue-500 hover:bg-blue-50 p-1 rounded"
        >
          <Edit size={14} />
        </button>
        <button
          onClick={() => removeRepositoryField(field)}
          className="text-red-500 hover:bg-red-50 p-1 rounded"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};

export default CSVMerge;