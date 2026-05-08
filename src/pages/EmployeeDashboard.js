import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

const EmployeeDashboard = () => {
  const { currentUser } = useAuth();
  const { addToast } = useToast();
  const [tasks, setTasks] = useState([]);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [filter, setFilter] = useState('all');
  const [employeeData, setEmployeeData] = useState(null);

  const loadEmployeeData = React.useCallback(() => {
    try {
      const employees = JSON.parse(localStorage.getItem('emp_users') || '[]');
      const employee = employees.find(emp => emp.id === currentUser.userId);
      setEmployeeData(employee);
    } catch (error) {
      console.error('Error loading employee data:', error);
    }
  }, [currentUser.userId]);

  const loadTasks = React.useCallback(() => {
    try {
      const allTasks = JSON.parse(localStorage.getItem('tasks') || '[]');
      const employeeTasks = allTasks.filter(task => task.assignedTo === currentUser.userId);
      setTasks(employeeTasks);
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  }, [currentUser.userId]);

  // Helper function to migrate old attendance logs
  const migrateAttendanceLogs = (logs) => {
    return logs.map(log => ({
      ...log,
      checkOutTime: log.checkOutTime || null,
      workingHours: log.workingHours || null,
      date: log.date || new Date(log.date || new Date()).toISOString().split('T')[0]
    }));
  };

  const loadAttendanceHistory = React.useCallback(() => {
    try {
      const allAttendance = JSON.parse(localStorage.getItem('attendance_logs') || '[]');
      const migratedLogs = migrateAttendanceLogs(allAttendance);
      const employeeAttendance = migratedLogs.filter(log => log.employeeId === currentUser.userId);
      
      // Get today's attendance
      const todayDate = new Date().toISOString().split('T')[0];
      const todayLog = employeeAttendance.find(log => log.date === todayDate);
      setTodayAttendance(todayLog);

      // Get last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentAttendance = employeeAttendance
        .filter(log => new Date(log.date) >= thirtyDaysAgo)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      
      setAttendanceHistory(recentAttendance);
    } catch (error) {
      console.error('Error loading attendance history:', error);
    }
  }, [currentUser.userId]);

  const updateTaskStatus = (taskId, newStatus) => {
    try {
      const allTasks = JSON.parse(localStorage.getItem('tasks') || '[]');
      const taskIndex = allTasks.findIndex(task => task.id === taskId);
      
      if (taskIndex !== -1) {
        allTasks[taskIndex].status = newStatus;
        localStorage.setItem('tasks', JSON.stringify(allTasks));
        
        setTasks(prev => prev.map(task => 
          task.id === taskId ? { ...task, status: newStatus } : task
        ));
        
        addToast('Task status updated successfully', 'success');
      }
    } catch (error) {
      console.error('Error updating task status:', error);
      addToast('Failed to update task status', 'error');
    }
  };

  const filteredTasks = tasks.filter(task => {
    if (filter === 'all') return true;
    return task.status === filter;
  });

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'priority-high';
      case 'medium': return 'priority-medium';
      case 'low': return 'priority-low';
      default: return 'priority-low';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'todo': return 'status-todo';
      case 'in-progress': return 'status-in-progress';
      case 'completed': return 'status-completed';
      default: return 'status-todo';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (timeString) => {
    if (!timeString) return '—';
    
    // Check if it's already in HH:MM:SS format
    if (timeString.includes(':') && timeString.split(':').length === 3) {
      const [hours, minutes] = timeString.split(':');
      const hour = parseInt(hours);
      const minute = parseInt(minutes);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minute.toString().padStart(2, '0')} ${ampm}`;
    }
    
    // Fallback for old date-time strings
    try {
      return new Date(timeString).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return '—';
    }
  };

  useEffect(() => {
    loadEmployeeData();
    loadTasks();
    loadAttendanceHistory();
  }, [currentUser, loadEmployeeData, loadTasks, loadAttendanceHistory]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gradient mb-2">
              Welcome back, {currentUser.name}!
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-gray-400">
              <span className="flex items-center">
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v3.57A22.952 22.952 0 0110 13a22.95 22.95 0 01-8-1.43V8a2 2 0 012-2h2zm2-1a1 1 0 011-1h2a1 1 0 011 1v1H8V5zm1 5a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" />
                  <path d="M2 13.692V16a2 2 0 002 2h12a2 2 0 002-2v-2.308A24.974 24.974 0 0110 15c-2.796 0-5.487-.46-8-1.308z" />
                </svg>
                {employeeData?.jobTitle}
              </span>
              <span className="flex items-center">
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
                </svg>
                {employeeData?.department}
              </span>
            </div>
          </div>
          
          <div className="mt-4 md:mt-0 text-center">
            <div className="flex items-center justify-center space-x-2 mb-2">
              <span className="text-gray-400">Today's Status:</span>
              <span className={`font-bold ${
                todayAttendance?.status === 'checked-in' ? 'text-amber-400' :
                todayAttendance?.status === 'present' ? 'text-green-400' :
                'text-red-400'
              }`}>
                {todayAttendance?.status === 'checked-in' ? '⏳ Checked In' :
                 todayAttendance?.status === 'present' ? '✓ Present' :
                 '✗ Absent'}
              </span>
            </div>
            {todayAttendance && (
              <div className="text-sm text-gray-400 space-y-1">
                <div className="flex items-center justify-center space-x-4">
                  <span>Check-in: {todayAttendance.checkInTime ? formatTime(todayAttendance.checkInTime) : '—'}</span>
                  <span>Check-out: {todayAttendance.checkOutTime ? formatTime(todayAttendance.checkOutTime) : '—'}</span>
                </div>
                <div>
                  Hours: {todayAttendance.workingHours || (todayAttendance.status === 'checked-in' ? 'In Progress...' : '—')}
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* My Tasks */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card p-6"
      >
        <h2 className="text-2xl font-bold text-gradient mb-6">My Tasks</h2>
        
        {/* Filter Tabs */}
        <div className="flex space-x-2 mb-6">
          {['all', 'todo', 'in-progress', 'completed'].map((filterOption) => (
            <button
              key={filterOption}
              onClick={() => setFilter(filterOption)}
              className={`px-4 py-2 rounded-lg transition-all ${
                filter === filterOption
                  ? 'bg-cyan text-black'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {filterOption.charAt(0).toUpperCase() + filterOption.slice(1).replace('-', ' ')}
            </button>
          ))}
        </div>

        {/* Tasks List */}
        <div className="space-y-4">
          {filteredTasks.length === 0 ? (
            <div className="text-center py-8">
              <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-gray-400">No tasks found</p>
            </div>
          ) : (
            filteredTasks.map((task) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-4 hover:border-cyan/50 transition-all"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg mb-2">{task.title}</h3>
                    <p className="text-gray-400 mb-3">{task.description}</p>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(task.priority)}`}>
                        {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                      </span>
                      <span className="text-sm text-gray-400">
                        Due: {formatDate(task.dueDate)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="mt-4 md:mt-0 md:ml-4">
                    <select
                      value={task.status}
                      onChange={(e) => updateTaskStatus(task.id, e.target.value)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium ${getStatusColor(task.status)} border border-gray-600 focus:outline-none focus:border-cyan`}
                    >
                      <option value="todo">Todo</option>
                      <option value="in-progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>

      {/* Attendance History */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card p-6"
      >
        <h2 className="text-2xl font-bold text-gradient mb-6">Attendance History (Last 30 Days)</h2>
        <div className="overflow-x-auto">
          {attendanceHistory.length === 0 ? (
            <div className="text-center py-8">
              <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-gray-400">No attendance records found</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4 text-gray-400">Date</th>
                  <th className="text-left py-3 px-4 text-gray-400">Check-In</th>
                  <th className="text-left py-3 px-4 text-gray-400">Check-Out</th>
                  <th className="text-left py-3 px-4 text-gray-400">Hours Worked</th>
                  <th className="text-left py-3 px-4 text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody>
                {attendanceHistory.map((record) => (
                  <motion.tr
                    key={record.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="border-b border-gray-800 hover:bg-gray-800/50"
                  >
                    <td className="py-3 px-4">{formatDate(record.date)}</td>
                    <td className="py-3 px-4">{record.checkInTime ? formatTime(record.checkInTime) : '—'}</td>
                    <td className="py-3 px-4">{record.checkOutTime ? formatTime(record.checkOutTime) : '—'}</td>
                    <td className="py-3 px-4">{record.workingHours || '—'}</td>
                    <td className="py-3 px-4">
                      {record.status === 'checked-in' ? (
                        <span className="flex items-center">
                          <span className="w-2 h-2 bg-amber-500 rounded-full mr-2"></span>
                          Checked In
                        </span>
                      ) : record.status === 'present' ? (
                        <span className="flex items-center">
                          <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                          Present
                        </span>
                      ) : (
                        <span className="flex items-center">
                          <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                          Absent
                        </span>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </motion.div>

      {/* Profile Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-card p-6"
      >
        <h2 className="text-2xl font-bold text-gradient mb-6">Profile</h2>
        <div className="flex flex-col md:flex-row items-center md:items-start space-y-4 md:space-y-0 md:space-x-6">
          <div className="w-24 h-24 bg-gradient-to-br from-cyan to-amber rounded-full flex items-center justify-center">
            <span className="text-black font-bold text-3xl">
              {currentUser.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 text-center md:text-left">
            <h3 className="text-xl font-bold mb-2">{currentUser.name}</h3>
            <div className="space-y-2 text-gray-400">
              <p><span className="text-gray-500">Email:</span> {currentUser.email}</p>
              <p><span className="text-gray-500">Department:</span> {employeeData?.department}</p>
              <p><span className="text-gray-500">Job Title:</span> {employeeData?.jobTitle}</p>
              <p><span className="text-gray-500">Registered:</span> {employeeData ? formatDate(employeeData.registeredAt) : 'N/A'}</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default EmployeeDashboard;
