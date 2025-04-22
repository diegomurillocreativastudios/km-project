import React, { useState, useEffect, useRef } from 'react';
import _ from 'lodash';
import Papa from 'papaparse';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Main App Component
const App = () => {
  const [tables, setTables] = useState([]);
  const [activeTable, setActiveTable] = useState(null);
  const [showCreateTableModal, setShowCreateTableModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showVisualizationModal, setShowVisualizationModal] = useState(false);
  const [importData, setImportData] = useState(null);
  const [sqlExport, setSqlExport] = useState('');
  const fileInputRef = useRef(null);
  const [draggedRow, setDraggedRow] = useState(null);
  const [relationships, setRelationships] = useState([]);
  
  // Create a new table
  const createTable = (tableName, columns) => {
    const newTable = {
      id: Date.now().toString(),
      name: tableName,
      columns: columns.map(col => ({
        id: Date.now() + Math.random().toString(),
        name: col.name,
        type: col.type
      })),
      rows: []
    };
    
    setTables([...tables, newTable]);
    setActiveTable(newTable.id);
    setShowCreateTableModal(false);
  };

  // Delete a table
  const deleteTable = (tableId) => {
    const updatedTables = tables.filter(table => table.id !== tableId);
    setTables(updatedTables);
    
    if (activeTable === tableId) {
      setActiveTable(updatedTables.length > 0 ? updatedTables[0].id : null);
    }
  };

  // Add a new row to a table
  const addRow = (tableId) => {
    const updatedTables = tables.map(table => {
      if (table.id === tableId) {
        const newRow = {
          id: Date.now().toString(),
          data: table.columns.reduce((acc, column) => {
            acc[column.id] = '';
            return acc;
          }, {})
        };
        return { ...table, rows: [...table.rows, newRow] };
      }
      return table;
    });
    
    setTables(updatedTables);
  };

  // Delete a row from a table
  const deleteRow = (tableId, rowId) => {
    const updatedTables = tables.map(table => {
      if (table.id === tableId) {
        return { 
          ...table, 
          rows: table.rows.filter(row => row.id !== rowId) 
        };
      }
      return table;
    });
    
    setTables(updatedTables);
  };

  // Update cell data in a table
  const updateCell = (tableId, rowId, columnId, value) => {
    const updatedTables = tables.map(table => {
      if (table.id === tableId) {
        const updatedRows = table.rows.map(row => {
          if (row.id === rowId) {
            return {
              ...row,
              data: {
                ...row.data,
                [columnId]: value
              }
            };
          }
          return row;
        });
        
        return { ...table, rows: updatedRows };
      }
      return table;
    });
    
    setTables(updatedTables);
  };

  // Handle drag start
  const handleDragStart = (e, tableId, rowId) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ tableId, rowId }));
    e.currentTarget.classList.add('opacity-50');
    setDraggedRow({ tableId, rowId });
  };
  
  // Handle drag over
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  
  // Handle drop
  const handleDrop = (e, targetTableId, targetIndex) => {
    e.preventDefault();
    
    try {
      // Get the dragged row info
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      const { tableId: sourceTableId, rowId: sourceRowId } = data;
      
      // If no valid data or same position, do nothing
      if (!sourceTableId || !sourceRowId) return;
      
      // Create a deep copy of tables array to work with
      const tablesCopy = _.cloneDeep(tables);
      
      // Find source and destination tables
      const sourceTable = tablesCopy.find(table => table.id === sourceTableId);
      const destTable = tablesCopy.find(table => table.id === targetTableId);
      
      if (!sourceTable || !destTable) return;
      
      // Find the source row and its index
      const sourceRowIndex = sourceTable.rows.findIndex(row => row.id === sourceRowId);
      if (sourceRowIndex === -1) return;
      
      // Get the row to be moved
      const [rowToMove] = sourceTable.rows.splice(sourceRowIndex, 1);
      
      // If moving between different tables, adapt the row data
      if (sourceTableId !== targetTableId) {
        // Create a mapping of column names to help match data
        const sourceColumnMap = sourceTable.columns.reduce((map, col) => {
          map[col.id] = col.name;
          return map;
        }, {});
        
        // Prepare the new row data structure for the destination table
        const newRowData = destTable.columns.reduce((acc, col) => {
          // Try to find a matching column in the source table by name
          const matchingSourceColId = Object.entries(sourceColumnMap).find(
            ([colId, colName]) => colName === col.name
          )?.[0];
          
          // Use the matched data or empty string if no match
          acc[col.id] = matchingSourceColId ? rowToMove.data[matchingSourceColId] : '';
          return acc;
        }, {});
        
        // Create the new row with adapted data
        const adaptedRow = {
          id: Date.now().toString(),
          data: newRowData
        };
        
        // Insert the adapted row in the destination table
        destTable.rows.splice(targetIndex, 0, adaptedRow);
      } else {
        // Same table, just reorder
        destTable.rows.splice(targetIndex, 0, rowToMove);
      }
      
      // Update the state with the modified tables
      setTables(tablesCopy);
      setDraggedRow(null);
    } catch (error) {
      console.error('Error handling drop:', error);
    }
  };
  
  // Handle drag end
  const handleDragEnd = (e) => {
    e.currentTarget.classList.remove('opacity-50');
    setDraggedRow(null);
  };

  // Import CSV data
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      Papa.parse(file, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
          setImportData(results);
          setShowImportModal(true);
        }
      });
    }
  };

  // Import CSV data to a table
  const importCSVToTable = (tableId, columnMapping) => {
    if (!importData || !tableId) return;
    
    const tableToUpdate = tables.find(table => table.id === tableId);
    if (!tableToUpdate) return;
    
    const updatedTables = tables.map(table => {
      if (table.id === tableId) {
        // Create new rows from the CSV data
        const newRows = importData.data.map(csvRow => {
          const rowData = {};
          
          Object.entries(columnMapping).forEach(([csvHeader, columnId]) => {
            if (columnId) {
              rowData[columnId] = csvRow[csvHeader] !== undefined ? csvRow[csvHeader] : '';
            }
          });
          
          // Fill in empty values for columns not in the mapping
          table.columns.forEach(col => {
            if (!Object.values(columnMapping).includes(col.id)) {
              rowData[col.id] = '';
            }
          });
          
          return {
            id: Date.now() + Math.random().toString(),
            data: rowData
          };
        });
        
        return { ...table, rows: [...table.rows, ...newRows] };
      }
      return table;
    });
    
    setTables(updatedTables);
    setShowImportModal(false);
    setImportData(null);
  };

  // Generate SQL export
  const generateSQLExport = (tableId) => {
    const tableToExport = tables.find(table => table.id === tableId);
    if (!tableToExport) return;
    
    let sql = `-- SQL Insert Statements for table ${tableToExport.name}\n\n`;
    
    // Create table statement (optional)
    sql += `CREATE TABLE ${tableToExport.name} (\n`;
    sql += tableToExport.columns.map(col => {
      return `  ${col.name} ${col.type}`;
    }).join(',\n');
    sql += '\n);\n\n';
    
    // Insert statements for each row
    tableToExport.rows.forEach(row => {
      const columnNames = tableToExport.columns.map(col => col.name).join(', ');
      const values = tableToExport.columns.map(col => {
        const value = row.data[col.id];
        if (typeof value === 'string') {
          return `'${value.replace(/'/g, "''")}'`; // Escape single quotes
        }
        return value !== null && value !== undefined ? value : 'NULL';
      }).join(', ');
      
      sql += `INSERT INTO ${tableToExport.name} (${columnNames}) VALUES (${values});\n`;
    });
    
    setSqlExport(sql);
    setShowExportModal(true);
  };

  // Detect and set table relationships
  const detectRelationships = () => {
    const relations = [];
    
    // For each table, check columns against other tables' columns
    tables.forEach(sourceTable => {
      sourceTable.columns.forEach(sourceColumn => {
        // Check if this column name matches a pattern like 'table_id' or 'tableId'
        const columnName = sourceColumn.name.toLowerCase();
        
        tables.forEach(targetTable => {
          // Skip self-references
          if (sourceTable.id === targetTable.id) return;
          
          // Check if column name matches target table name (with _id suffix)
          const targetTableName = targetTable.name.toLowerCase();
          if (
            columnName === `${targetTableName}_id` ||
            columnName === `${targetTableName}id` ||
            // Also try without pluralization
            (targetTableName.endsWith('s') && 
              (columnName === `${targetTableName.slice(0, -1)}_id` ||
               columnName === `${targetTableName.slice(0, -1)}id`))
          ) {
            // Found a potential relationship
            relations.push({
              sourceTableId: sourceTable.id,
              sourceColumnId: sourceColumn.id,
              targetTableId: targetTable.id,
              // Find the target table's primary key (usually first column or id column)
              targetColumnId: targetTable.columns.find(col => 
                col.name.toLowerCase() === 'id' || 
                col.name.toLowerCase() === `${targetTableName}_id`
              )?.id || targetTable.columns[0]?.id
            });
          }
        });
      });
    });
    
    setRelationships(relations);
  };
  
  // Update relationships whenever tables change
  useEffect(() => {
    if (tables.length > 1) {
      detectRelationships();
    }
  }, [tables]);

  // Render the active table or a message if no tables exist
  const renderContent = () => {
    if (tables.length === 0) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center p-8 bg-gray-100 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">No tables yet</h2>
            <p className="mb-4">Create your first database table to get started.</p>
            <button
              onClick={() => setShowCreateTableModal(true)}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Create Table
            </button>
          </div>
        </div>
      );
    }
    
    const currentTable = tables.find(table => table.id === activeTable);
    if (!currentTable) return null;
    
    return (
      <div className="h-full flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold">{currentTable.name}</h2>
          <div className="space-x-2">
            <button
              onClick={() => addRow(currentTable.id)}
              className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600"
            >
              Add Row
            </button>
            <button
              onClick={() => {
                if (fileInputRef.current) fileInputRef.current.click();
              }}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Import CSV
            </button>
            <button
              onClick={() => generateSQLExport(currentTable.id)}
              className="px-3 py-1 bg-purple-500 text-white rounded hover:bg-purple-600"
            >
              Export SQL
            </button>
            <button
              onClick={() => setShowVisualizationModal(true)}
              className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600"
            >
              Visualize
            </button>
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        </div>
        
        <div className="flex-grow overflow-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                {currentTable.columns.map(column => (
                  <th
                    key={column.id}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {column.name}
                    <span className="text-gray-400 ml-1">({column.type})</span>
                  </th>
                ))}
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentTable.rows.map((row, index) => (
                <tr 
                  key={row.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, currentTable.id, row.id)}
                  onDragEnd={handleDragEnd}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, currentTable.id, index)}
                  className="hover:bg-gray-50 cursor-move"
                >
                  {currentTable.columns.map(column => (
                    <td key={column.id} className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="text"
                        value={row.data[column.id] || ''}
                        onChange={(e) => updateCell(currentTable.id, row.id, column.id, e.target.value)}
                        className="border rounded px-2 py-1 w-full"
                      />
                    </td>
                  ))}
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => deleteRow(currentTable.id, row.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {/* Drop zone for empty table */}
              {currentTable.rows.length === 0 && (
                <tr 
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, currentTable.id, 0)}
                  className="h-16 border-dashed border-2 border-gray-300"
                >
                  <td colSpan={currentTable.columns.length + 1} className="text-center text-gray-500">
                    Drop rows here
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-gray-800 text-white p-4 flex flex-col">
        <h1 className="text-xl font-bold mb-6">Database Manager</h1>
        
        <div className="mb-4">
          <button
            onClick={() => setShowCreateTableModal(true)}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Create New Table
          </button>
        </div>
        
        <div className="flex-grow overflow-auto">
          <h2 className="text-sm uppercase tracking-wider text-gray-400 mb-2">Tables</h2>
          <ul className="space-y-1">
            {tables.map(table => (
              <li
                key={table.id}
                className={`p-2 rounded cursor-pointer flex justify-between items-center ${
                  activeTable === table.id ? 'bg-gray-700' : 'hover:bg-gray-700'
                }`}
                onClick={() => setActiveTable(table.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, table.id, table.rows.length)}
              >
                <span className="truncate">{table.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteTable(table.id);
                  }}
                  className="text-red-400 hover:text-red-300"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
      
      {/* Main content */}
      <div className="flex-grow overflow-hidden">
        {renderContent()}
      </div>
      
      {/* Create Table Modal */}
      {showCreateTableModal && (
        <CreateTableModal
          onClose={() => setShowCreateTableModal(false)}
          onCreateTable={createTable}
        />
      )}
      
      {/* Import CSV Modal */}
      {showImportModal && importData && (
        <ImportCSVModal
          onClose={() => {
            setShowImportModal(false);
            setImportData(null);
          }}
          tables={tables}
          csvHeaders={importData.meta.fields || []}
          onImport={importCSVToTable}
        />
      )}
      
      {/* Export SQL Modal */}
      {showExportModal && (
        <ExportSQLModal
          sql={sqlExport}
          onClose={() => {
            setShowExportModal(false);
            setSqlExport('');
          }}
        />
      )}
      
      {/* Visualization Modal */}
      {showVisualizationModal && (
        <VisualizationModal
          tables={tables}
          relationships={relationships}
          onClose={() => setShowVisualizationModal(false)}
        />
      )}
    </div>
  );
};

// CreateTableModal Component
const CreateTableModal = ({ onClose, onCreateTable }) => {
  const [tableName, setTableName] = useState('');
  const [columns, setColumns] = useState([
    { id: '1', name: '', type: 'VARCHAR(255)' }
  ]);
  
  const addColumn = () => {
    setColumns([
      ...columns,
      { id: Date.now().toString(), name: '', type: 'VARCHAR(255)' }
    ]);
  };
  
  const removeColumn = (id) => {
    if (columns.length > 1) {
      setColumns(columns.filter(col => col.id !== id));
    }
  };
  
  const updateColumn = (id, field, value) => {
    setColumns(
      columns.map(col =>
        col.id === id ? { ...col, [field]: value } : col
      )
    );
  };
  
  const handleSubmit = () => {
    if (!tableName.trim()) return;
    
    const validColumns = columns.filter(col => col.name.trim());
    if (validColumns.length === 0) return;
    
    onCreateTable(tableName, validColumns);
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h2 className="text-xl font-semibold mb-4">Create New Table</h2>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Table Name
          </label>
          <input
            type="text"
            value={tableName}
            onChange={(e) => setTableName(e.target.value)}
            className="w-full border rounded px-3 py-2"
            placeholder="Enter table name"
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Columns
          </label>
          {columns.map(column => (
            <div key={column.id} className="flex gap-2 mb-2">
              <input
                type="text"
                value={column.name}
                onChange={(e) => updateColumn(column.id, 'name', e.target.value)}
                className="flex-grow border rounded px-3 py-2"
                placeholder="Column name"
              />
              <select
                value={column.type}
                onChange={(e) => updateColumn(column.id, 'type', e.target.value)}
                className="border rounded px-3 py-2"
              >
                <option value="VARCHAR(255)">VARCHAR(255)</option>
                <option value="INTEGER">INTEGER</option>
                <option value="DECIMAL(10,2)">DECIMAL(10,2)</option>
                <option value="TEXT">TEXT</option>
                <option value="DATE">DATE</option>
                <option value="BOOLEAN">BOOLEAN</option>
              </select>
              <button
                onClick={() => removeColumn(column.id)}
                className="px-2 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                disabled={columns.length <= 1}
              >
                ×
              </button>
            </div>
          ))}
          <button
            onClick={addColumn}
            className="mt-2 text-blue-500 hover:text-blue-700"
          >
            + Add column
          </button>
        </div>
        
        <div className="flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            disabled={!tableName.trim() || !columns.some(col => col.name.trim())}
          >
            Create Table
          </button>
        </div>
      </div>
    </div>
  );
};

// ImportCSVModal Component
const ImportCSVModal = ({ onClose, tables, csvHeaders, onImport }) => {
  const [selectedTable, setSelectedTable] = useState('');
  const [columnMapping, setColumnMapping] = useState({});
  
  // Initialize mappings when selected table changes
  useEffect(() => {
    if (selectedTable) {
      const table = tables.find(t => t.id === selectedTable);
      if (table) {
        // Try to auto-match columns by name
        const initialMapping = {};
        csvHeaders.forEach(header => {
          const matchingColumn = table.columns.find(col => 
            col.name.toLowerCase() === header.toLowerCase()
          );
          if (matchingColumn) {
            initialMapping[header] = matchingColumn.id;
          } else {
            initialMapping[header] = '';
          }
        });
        setColumnMapping(initialMapping);
      }
    }
  }, [selectedTable, tables, csvHeaders]);
  
  const updateMapping = (csvHeader, columnId) => {
    setColumnMapping({
      ...columnMapping,
      [csvHeader]: columnId
    });
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-lg w-full p-6">
        <h2 className="text-xl font-semibold mb-4">Import CSV Data</h2>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Select Target Table
          </label>
          <select
            value={selectedTable}
            onChange={(e) => setSelectedTable(e.target.value)}
            className="w-full border rounded px-3 py-2"
          >
            <option value="">Select a table...</option>
            {tables.map(table => (
              <option key={table.id} value={table.id}>
                {table.name}
              </option>
            ))}
          </select>
        </div>
        
        {selectedTable && (
          <div className="mb-4">
            <h3 className="text-md font-medium mb-2">Map CSV Columns to Table Columns</h3>
            <div className="max-h-64 overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      CSV Header
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Table Column
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {csvHeaders.map(header => (
                    <tr key={header}>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {header}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <select
                          value={columnMapping[header] || ''}
                          onChange={(e) => updateMapping(header, e.target.value)}
                          className="border rounded px-2 py-1 w-full"
                        >
                          <option value="">Do not import</option>
                          {tables
                            .find(t => t.id === selectedTable)
                            ?.columns.map(column => (
                              <option key={column.id} value={column.id}>
                                {column.name}
                              </option>
                            ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        <div className="flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={() => onImport(selectedTable, columnMapping)}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            disabled={!selectedTable}
          >
            Import Data
          </button>
        </div>
      </div>
    </div>
  );
};

// ExportSQLModal Component
const ExportSQLModal = ({ sql, onClose }) => {
  const textareaRef = useRef(null);
  
  const copyToClipboard = () => {
    if (textareaRef.current) {
      textareaRef.current.select();
      document.execCommand('copy');
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full p-6">
        <h2 className="text-xl font-semibold mb-4">Export SQL</h2>
        
        <div className="mb-4">
          <textarea
            ref={textareaRef}
            value={sql}
            readOnly
            className="w-full h-64 border rounded px-3 py-2 font-mono text-sm"
          />
        </div>
        
        <div className="flex justify-end space-x-2">
          <button
            onClick={copyToClipboard}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Copy to Clipboard
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded hover:bg-gray-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// VisualizationModal Component
const VisualizationModal = ({ tables, relationships, onClose }) => {
  const svgRef = useRef(null);
  const [view, setView] = useState('er'); // 'er' or 'data'
  const [selectedTable, setSelectedTable] = useState('');
  const [chartData, setChartData] = useState([]);
  const [chartConfig, setChartConfig] = useState({
    xAxis: '',
    yAxis: ''
  });
  
  const handleTableSelect = (e) => {
    setSelectedTable(e.target.value);
    // Reset chart config when changing tables
    setChartConfig({
      xAxis: '',
      yAxis: ''
    });
    setChartData([]);
  };
  
  const updateChartConfig = (field, value) => {
    setChartConfig({
      ...chartConfig,
      [field]: value
    });
  };
  
  const generateChartData = () => {
    const table = tables.find(t => t.id === selectedTable);
    if (!table || !chartConfig.xAxis || !chartConfig.yAxis) return;
    
    const xColumn = table.columns.find(col => col.id === chartConfig.xAxis);
    const yColumn = table.columns.find(col => col.id === chartConfig.yAxis);
    
    if (!xColumn || !yColumn) return;
    
    // Generate chart data from the table rows
    const data = table.rows.map(row => ({
      name: row.data[xColumn.id] || '',
      value: parseFloat(row.data[yColumn.id]) || 0
    }));
    
    setChartData(data);
  };
  
  useEffect(() => {
    if (chartConfig.xAxis && chartConfig.yAxis && selectedTable) {
      generateChartData();
    }
  }, [chartConfig, selectedTable]);
  
  const renderERDiagram = () => {
    const svgWidth = Math.max(800, tables.length * 250);
    const svgHeight = 600;
    const tableWidth = 180;
    const tableHeight = 40;
    const columnHeight = 25;
    const tablePadding = 70;
    
    // Calculate positions for tables
    const tablePositions = tables.reduce((acc, table, index) => {
      // Arrange tables in a grid layout
      const cols = Math.ceil(Math.sqrt(tables.length));
      const x = (index % cols) * (tableWidth + tablePadding) + 50;
      const y = Math.floor(index / cols) * 300 + 50;
      
      acc[table.id] = { x, y };
      return acc;
    }, {});
    
    return (
      <div className="w-full overflow-auto" style={{ maxHeight: '70vh' }}>
        <svg
          ref={svgRef}
          width={svgWidth}
          height={svgHeight}
          className="border rounded"
        >
          {/* Tables */}
          {tables.map(table => {
            const position = tablePositions[table.id];
            const totalHeight = tableHeight + (table.columns.length * columnHeight);
            
            return (
              <g key={table.id} transform={`translate(${position.x}, ${position.y})`}>
                {/* Table box */}
                <rect
                  width={tableWidth}
                  height={totalHeight}
                  rx="5"
                  ry="5"
                  fill="#f0f8ff"
                  stroke="#4682b4"
                  strokeWidth="2"
                />
                
                {/* Table header */}
                <rect
                  width={tableWidth}
                  height={tableHeight}
                  rx="5"
                  ry="5"
                  fill="#4682b4"
                />
                
                {/* Table name */}
                <text
                  x={tableWidth / 2}
                  y={tableHeight / 2 + 5}
                  textAnchor="middle"
                  fill="white"
                  fontFamily="Arial, sans-serif"
                  fontWeight="bold"
                >
                  {table.name}
                </text>
                
                {/* Table columns */}
                {table.columns.map((column, colIndex) => {
                  const isPrimaryKey = colIndex === 0; // Assume first column is PK
                  const isForeignKey = relationships.some(r => 
                    r.sourceTableId === table.id && r.sourceColumnId === column.id
                  );
                  
                  return (
                    <g key={column.id} transform={`translate(0, ${tableHeight + (colIndex * columnHeight)})`}>
                      {/* Column row */}
                      <rect
                        width={tableWidth}
                        height={columnHeight}
                        fill={colIndex % 2 === 0 ? "#f5f5f5" : "#ffffff"}
                      />
                      
                      {/* Primary/Foreign key indicators */}
                      {isPrimaryKey && (
                        <circle cx="10" cy="12" r="4" fill="#ffd700" />
                      )}
                      {isForeignKey && (
                        <circle cx="10" cy="12" r="4" fill="#a0a0a0" />
                      )}
                      
                      {/* Column name */}
                      <text
                        x={isPrimaryKey || isForeignKey ? 20 : 10}
                        y="16"
                        fontFamily="Arial, sans-serif"
                        fontSize="12"
                      >
                        {column.name} ({column.type})
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}
          
          {/* Relationship lines */}
          {relationships.map((relation, index) => {
            const sourceTable = tablePositions[relation.sourceTableId];
            const targetTable = tablePositions[relation.targetTableId];
            
            if (!sourceTable || !targetTable) return null;
            
            // Calculate center points of tables
            const sourceX = sourceTable.x + tableWidth / 2;
            const sourceY = sourceTable.y + tableHeight / 2;
            const targetX = targetTable.x + tableWidth / 2;
            const targetY = targetTable.y + tableHeight / 2;
            
            // Draw line with arrow
            const path = `M${sourceX},${sourceY} L${targetX},${targetY}`;
            
            // Calculate arrow points
            const dx = targetX - sourceX;
            const dy = targetY - sourceY;
            const angle = Math.atan2(dy, dx);
            
            const arrowSize = 10;
            const arrowX1 = targetX - arrowSize * Math.cos(angle - Math.PI / 6);
            const arrowY1 = targetY - arrowSize * Math.sin(angle - Math.PI / 6);
            const arrowX2 = targetX - arrowSize * Math.cos(angle + Math.PI / 6);
            const arrowY2 = targetY - arrowSize * Math.sin(angle + Math.PI / 6);
            
            return (
              <g key={`rel-${index}`}>
                <path
                  d={path}
                  stroke="#708090"
                  strokeWidth="1.5"
                  fill="none"
                  markerEnd="url(#arrow)"
                />
                <polygon
                  points={`${targetX},${targetY} ${arrowX1},${arrowY1} ${arrowX2},${arrowY2}`}
                  fill="#708090"
                />
              </g>
            );
          })}
          
          {/* Legend */}
          <g transform="translate(50, 550)">
            <rect width="300" height="80" fill="#f9f9f9" stroke="#d0d0d0" rx="5" ry="5" />
            <text x="10" y="20" fontFamily="Arial, sans-serif" fontSize="12" fontWeight="bold">
              Legend:
            </text>
            
            <circle cx="20" cy="40" r="4" fill="#ffd700" />
            <text x="30" y="44" fontFamily="Arial, sans-serif" fontSize="12">
              Primary Key
            </text>
            
            <circle cx="120" cy="40" r="4" fill="#a0a0a0" />
            <text x="130" y="44" fontFamily="Arial, sans-serif" fontSize="12">
              Foreign Key
            </text>
            
            <line x1="20" y1="60" x2="50" y2="60" stroke="#708090" strokeWidth="1.5" />
            <polygon points="50,60 45,56 45,64" fill="#708090" />
            <text x="60" y="64" fontFamily="Arial, sans-serif" fontSize="12">
              Relationship
            </text>
          </g>
        </svg>
      </div>
    );
  };
  
  const renderDataVisualization = () => {
    if (!selectedTable) {
      return (
        <div className="text-center p-4">
          <p>Select a table to visualize its data</p>
        </div>
      );
    }
    
    const table = tables.find(t => t.id === selectedTable);
    if (!table) return null;
    
    return (
      <div className="p-4">
        <div className="mb-4 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              X-Axis Column
            </label>
            <select
              value={chartConfig.xAxis}
              onChange={(e) => updateChartConfig('xAxis', e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">Select X-Axis Column</option>
              {table.columns.map(col => (
                <option key={`x-${col.id}`} value={col.id}>
                  {col.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Y-Axis Column
            </label>
            <select
              value={chartConfig.yAxis}
              onChange={(e) => updateChartConfig('yAxis', e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">Select Y-Axis Column</option>
              {table.columns.map(col => (
                <option key={`y-${col.id}`} value={col.id}>
                  {col.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        {chartData.length > 0 && (
          <div className="border rounded p-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#8884d8"
                  activeDot={{ r: 8 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-6xl w-full p-6 max-h-screen overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Database Visualization</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setView('er')}
              className={`px-3 py-1 rounded ${
                view === 'er' ? 'bg-blue-500 text-white' : 'bg-gray-200'
              }`}
            >
              ER Diagram
            </button>
            <button
              onClick={() => setView('data')}
              className={`px-3 py-1 rounded ${
                view === 'data' ? 'bg-blue-500 text-white' : 'bg-gray-200'
              }`}
            >
              Data Visualization
            </button>
          </div>
        </div>
        
        {view === 'data' && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Table
            </label>
            <select
              value={selectedTable}
              onChange={handleTableSelect}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">Select a table...</option>
              {tables.map(table => (
                <option key={table.id} value={table.id}>
                  {table.name}
                </option>
              ))}
            </select>
          </div>
        )}
        
        <div className="flex-grow overflow-auto">
          {view === 'er' ? renderERDiagram() : renderDataVisualization()}
        </div>
        
        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded hover:bg-gray-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;