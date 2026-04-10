import { Routes, Route, Navigate } from 'react-router-dom';
import TaskQueue from './views/TaskQueue';
import OperatorTask from './views/OperatorTask';
import Designer from './views/Designer';

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        <Route path="/" element={<TaskQueue />} />
        <Route path="/task/:id" element={<OperatorTask />} />
        <Route path="/designer" element={<Designer />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
