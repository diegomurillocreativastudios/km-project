import { useState } from 'react';
import HomePage from "./HomePage";
import MSAsankey1 from "./MSAsankey1";
import Clauses from "./Clauses";
import MSAcharts from "./MSAcharts";
import MSAdashboard from "./MSAdashboard";
import Curate from "./ContractCurate";
import Relate from "./Relate";
import Calendar1 from "./Calendar1";
import Extractor from "./Extractor";
import Budget from "./Budget";


function App() {
  const [activeComponent, setActiveComponent] = useState('HomePage');

  const renderComponent = () => {
    switch (activeComponent) {
      case 'MSAsankey1':
        return <MSAsankey1 />;
      case 'Clauses':
        return <Clauses />;
      case 'MSAcharts':
        return <MSAcharts />;
      case 'MSAdashboard':
        return <MSAdashboard />;
      case 'HomePage':
        return <HomePage />;
      case 'Curate':
        return <Curate />;
      case 'Relate':
        return <Relate />;
      case 'Calendar1':
          return <Calendar1 />;
      case 'Extractor':
        return <Extractor />;
      case 'Budget':
          return <Budget />;
      default:
        return <HomePage />;
    }
  };

  return (
    <div>
      <nav className="p-4 bg-gray-100">
      <button 
          onClick={() => setActiveComponent('HomePage')}
          className="px-4 py-2 mr-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Home Page
        </button>
        <button 
          onClick={() => setActiveComponent('MSAsankey1')}
          className="px-4 py-2 mr-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Legal Analysis
        </button>
        <button 
          onClick={() => setActiveComponent('Clauses')}
          className="px-4 py-2 mr-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Clause Analysis
        </button>
        <button 
          onClick={() => setActiveComponent('MSAcharts')}
          className="px-4 py-2 mr-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Financial Analysis
        </button>
        <button 
          onClick={() => setActiveComponent('MSAdashboard')}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Dashboard View
        </button>
        <button 
          onClick={() => setActiveComponent('Curate')}
          className="px-4 py-2 mr-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Curate
        </button>
        <button 
          onClick={() => setActiveComponent('Relate')}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Relate
        </button>
        <button 
          onClick={() => setActiveComponent('Calendar1')}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Calendar
        </button>
        <button 
          onClick={() => setActiveComponent('Extractor')}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Extractor
        </button>
        <button 
          onClick={() => setActiveComponent('Budget')}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Budget
        </button>
      </nav>
      {renderComponent()}
    </div>
  );
}

export default App;