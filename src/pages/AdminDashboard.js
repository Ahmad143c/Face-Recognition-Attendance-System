import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { v4 as uuidv4 } from 'uuid';
import { BarChart, Bar, PieChart, Pie, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell, ResponsiveContainer } from 'recharts';

const AdminDashboard = () => {
  const { currentUser } = useAuth();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [employees, setEmployees] = useState([]);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    assignedTo: '',
    priority: 'medium',
    dueDate: ''
  });

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Helper function to migrate old attendance logs
  const migrateAttendanceLogs = (logs) => {
    return logs.map(log => ({
      ...log,
      checkOutTime: log.checkOutTime || null,
      workingHours: log.workingHours || null,
      date: log.date || new Date(log.date || new Date()).toISOString().split('T')[0]
    }));
  };

  const loadData = () => {
    try {
      setEmployees(JSON.parse(localStorage.getItem('emp_users') || '[]'));
      const attendanceData = JSON.parse(localStorage.getItem('attendance_logs') || '[]');
      setAttendanceLogs(migrateAttendanceLogs(attendanceData));
      setTasks(JSON.parse(localStorage.getItem('tasks') || '[]'));
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const getStats = () => {
    const today = new Date().toDateString();
    const todayAttendance = attendanceLogs.filter(log => 
      new Date(log.date).toDateString() === today
    );
    const completedTasks = tasks.filter(task => task.status === 'completed');
    const pendingTasks = tasks.filter(task => task.status !== 'completed');

    return {
      totalEmployees: employees.length,
      presentToday: todayAttendance.length,
      tasksCompleted: completedTasks.length,
      pendingTasks: pendingTasks.length
    };
  };

  const getRecentActivity = () => {
    return attendanceLogs
      .sort((a, b) => new Date(b.checkInTime) - new Date(a.checkInTime))
      .slice(0, 10);
  };

  const deleteEmployee = (employeeId) => {
    if (window.confirm('Are you sure you want to delete this employee? This action cannot be undone.')) {
      try {
        const updatedEmployees = employees.filter(emp => emp.id !== employeeId);
        localStorage.setItem('emp_users', JSON.stringify(updatedEmployees));
        setEmployees(updatedEmployees);
        
        // Also delete related tasks and attendance logs
        const updatedTasks = tasks.filter(task => task.assignedTo !== employeeId);
        localStorage.setItem('tasks', JSON.stringify(updatedTasks));
        setTasks(updatedTasks);
        
        const updatedAttendance = attendanceLogs.filter(log => log.employeeId !== employeeId);
        localStorage.setItem('attendance_logs', JSON.stringify(updatedAttendance));
        setAttendanceLogs(updatedAttendance);
        
        addToast('Employee deleted successfully', 'success');
      } catch (error) {
        console.error('Error deleting employee:', error);
        addToast('Failed to delete employee', 'error');
      }
    }
  };

  const createTask = (e) => {
    e.preventDefault();
    try {
      const newTask = {
        id: uuidv4(),
        ...taskForm,
        status: 'todo',
        createdAt: new Date().toISOString()
      };

      const updatedTasks = [...tasks, newTask];
      localStorage.setItem('tasks', JSON.stringify(updatedTasks));
      setTasks(updatedTasks);
      
      setTaskForm({
        title: '',
        description: '',
        assignedTo: '',
        priority: 'medium',
        dueDate: ''
      });
      setShowTaskModal(false);
      addToast('Task assigned successfully', 'success');
    } catch (error) {
      console.error('Error creating task:', error);
      addToast('Failed to assign task', 'error');
    }
  };

  const deleteTask = (taskId) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      try {
        const updatedTasks = tasks.filter(task => task.id !== taskId);
        localStorage.setItem('tasks', JSON.stringify(updatedTasks));
        setTasks(updatedTasks);
        addToast('Task deleted successfully', 'success');
      } catch (error) {
        console.error('Error deleting task:', error);
        addToast('Failed to delete task', 'error');
      }
    }
  };

  const updateTaskStatus = (taskId, newStatus) => {
    try {
      const updatedTasks = tasks.map(task => 
        task.id === taskId ? { ...task, status: newStatus } : task
      );
      localStorage.setItem('tasks', JSON.stringify(updatedTasks));
      setTasks(updatedTasks);
      addToast('Task status updated', 'success');
    } catch (error) {
      console.error('Error updating task:', error);
      addToast('Failed to update task', 'error');
    }
  };

  const exportToCSV = () => {
    try {
      const dateAttendance = attendanceLogs.filter(log => 
        log.date === selectedDate
      );
      
      if (dateAttendance.length === 0) {
        addToast('No attendance records to export for this date', 'error');
        return;
      }

      // Create CSV content
      const headers = ['Name', 'Department', 'Date', 'Check-In Time', 'Check-Out Time', 'Hours Worked', 'Status'];
      const csvContent = [
        headers.join(','),
        ...dateAttendance.map(record => [
          record.employeeName || '',
          record.department || '',
          record.date || '',
          record.checkInTime ? formatTime(record.checkInTime) : '',
          record.checkOutTime ? formatTime(record.checkOutTime) : '',
          record.workingHours || '',
          record.status === 'checked-in' ? 'Checked In' : 
          record.status === 'present' ? 'Present' : 'Absent'
        ].join(','))
      ].join('\n');

      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance_${selectedDate}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      addToast('Attendance data exported successfully', 'success');
    } catch (error) {
      console.error('Error exporting CSV:', error);
      addToast('Failed to export attendance data', 'error');
    }
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         emp.department.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDepartment = !departmentFilter || emp.department === departmentFilter;
    return matchesSearch && matchesDepartment;
  });

  const getTasksByStatus = () => {
    const todo = tasks.filter(task => task.status === 'todo');
    const inProgress = tasks.filter(task => task.status === 'in-progress');
    const completed = tasks.filter(task => task.status === 'completed');
    return { todo, inProgress, completed };
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'priority-high';
      case 'medium': return 'priority-medium';
      case 'low': return 'priority-low';
      default: return 'priority-low';
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

  const stats = getStats();
  const { todo, inProgress, completed } = getTasksByStatus();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-bold text-gradient">Admin Dashboard</h1>
        <div className="text-gray-400 mt-2 md:mt-0">
          Welcome, {currentUser.name}
        </div>
      </div>

      {/* Sidebar Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-gray-800">
        {['overview', 'employees', 'attendance', 'tasks', 'analytics'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 font-medium transition-all ${
              activeTab === tab
                ? 'text-cyan border-b-2 border-cyan'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <motion.div whileHover={{ scale: 1.02 }} className="glass-card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Total Employees</p>
                  <p className="text-3xl font-bold text-cyan">{stats.totalEmployees}</p>
                </div>
                <div className="w-12 h-12 bg-cyan/20 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-cyan" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                  </svg>
                </div>
              </div>
            </motion.div>

            <motion.div whileHover={{ scale: 1.02 }} className="glass-card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Present Today</p>
                  <p className="text-3xl font-bold text-green-400">{stats.presentToday}</p>
                </div>
                <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </motion.div>

            <motion.div whileHover={{ scale: 1.02 }} className="glass-card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Tasks Completed</p>
                  <p className="text-3xl font-bold text-amber">{stats.tasksCompleted}</p>
                </div>
                <div className="w-12 h-12 bg-amber/20 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-amber" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </motion.div>

            <motion.div whileHover={{ scale: 1.02 }} className="glass-card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Pending Tasks</p>
                  <p className="text-3xl font-bold text-red-400">{stats.pendingTasks}</p>
                </div>
                <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Recent Activity */}
          <div className="glass-card p-6">
            <h2 className="text-xl font-bold text-gradient mb-4">Recent Activity</h2>
            <div className="space-y-3">
              {getRecentActivity().length === 0 ? (
                <p className="text-gray-400 text-center py-8">No recent activity</p>
              ) : (
                getRecentActivity().map((activity) => (
                  <motion.div
                    key={activity.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-cyan/20 rounded-full flex items-center justify-center">
                        <span className="text-cyan text-xs font-bold">
                          {activity.employeeName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{activity.employeeName}</p>
                        <p className="text-sm text-gray-400">{activity.department}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-green-400">Checked In</p>
                      <p className="text-xs text-gray-400">{formatTime(activity.checkInTime)}</p>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Employees Tab */}
      {activeTab === 'employees' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="flex flex-col md:flex-row gap-4">
            <input
              type="text"
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field flex-1"
            />
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="input-field md:w-48"
            >
              <option value="">All Departments</option>
              {['Engineering', 'Marketing', 'HR', 'Finance', 'Operations', 'Design'].map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          <div className="glass-card p-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4 text-gray-400">Name</th>
                    <th className="text-left py-3 px-4 text-gray-400">Department</th>
                    <th className="text-left py-3 px-4 text-gray-400">Job Title</th>
                    <th className="text-left py-3 px-4 text-gray-400">Email</th>
                    <th className="text-left py-3 px-4 text-gray-400">Registered</th>
                    <th className="text-left py-3 px-4 text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-8 text-gray-400">
                        No employees found
                      </td>
                    </tr>
                  ) : (
                    filteredEmployees.map((employee) => (
                      <motion.tr
                        key={employee.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="border-b border-gray-800 hover:bg-gray-800/50"
                      >
                        <td className="py-3 px-4">{employee.name}</td>
                        <td className="py-3 px-4">{employee.department}</td>
                        <td className="py-3 px-4">{employee.jobTitle}</td>
                        <td className="py-3 px-4">{employee.email}</td>
                        <td className="py-3 px-4">{formatDate(employee.registeredAt)}</td>
                        <td className="py-3 px-4">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => {
                                setSelectedEmployee(employee);
                                setShowEmployeeModal(true);
                              }}
                              className="text-cyan hover:text-cyan/80"
                            >
                              View
                            </button>
                            <button
                              onClick={() => deleteEmployee(employee.id)}
                              className="text-red-400 hover:text-red-300"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* Attendance Tab */}
      {activeTab === 'attendance' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="input-field"
            />
            <button
              onClick={exportToCSV}
              className="btn-secondary"
            >
              Export to CSV
            </button>
          </div>

          <div className="glass-card p-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4 text-gray-400">Employee</th>
                    <th className="text-left py-3 px-4 text-gray-400">Department</th>
                    <th className="text-left py-3 px-4 text-gray-400">Check-In</th>
                    <th className="text-left py-3 px-4 text-gray-400">Check-Out</th>
                    <th className="text-left py-3 px-4 text-gray-400">Hours Worked</th>
                    <th className="text-left py-3 px-4 text-gray-400">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const dateAttendance = attendanceLogs.filter(log => 
                      log.date === selectedDate
                    );
                    
                    if (dateAttendance.length === 0) {
                      return (
                        <tr>
                          <td colSpan="6" className="text-center py-8 text-gray-400">
                            No attendance records for this date
                          </td>
                        </tr>
                      );
                    }
                    
                    const totalEmployees = employees.length;
                    const presentCount = dateAttendance.filter(log => log.status === 'present').length;
                    const checkedInCount = dateAttendance.filter(log => log.status === 'checked-in').length;
                    const absentCount = totalEmployees - presentCount - checkedInCount;
                    const avgHoursWorked = dateAttendance
                      .filter(log => log.workingHours)
                      .reduce((sum, log) => {
                        const [hours, minutes] = log.workingHours.replace('h', ' ').replace('m', '').split(' ').map(Number);
                        return sum + hours + (minutes / 60);
                      }, 0) / (presentCount || 1);
                    
                    return [
                      ...dateAttendance.map((record) => (
                        <motion.tr
                          key={record.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="border-b border-gray-800 hover:bg-gray-800/50"
                        >
                          <td className="py-3 px-4">{record.employeeName}</td>
                          <td className="py-3 px-4">{record.department}</td>
                          <td className="py-3 px-4">{record.checkInTime ? formatTime(record.checkInTime) : '—'}</td>
                          <td className="py-3 px-4">{record.checkOutTime ? formatTime(record.checkOutTime) : '—'}</td>
                          <td className="py-3 px-4">{record.workingHours || '—'}</td>
                          <td className="py-3 px-4">
                            {record.status === 'checked-in' ? (
                              <span className="flex items-center px-2 py-1 bg-amber-500/20 text-amber-400 rounded text-xs font-medium">
                                <span className="w-2 h-2 bg-amber-500 rounded-full mr-2"></span>
                                Checked In
                              </span>
                            ) : record.status === 'present' ? (
                              <span className="flex items-center px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-medium">
                                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                                Present
                              </span>
                            ) : (
                              <span className="flex items-center px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs font-medium">
                                <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                                Absent
                              </span>
                            )}
                          </td>
                        </motion.tr>
                      )),
                      // Summary row
                      <motion.tr
                        key="summary"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="border-t-2 border-gray-600 bg-gray-800/50 font-bold"
                      >
                        <td className="py-3 px-4">Summary</td>
                        <td className="py-3 px-4">Total: {totalEmployees}</td>
                        <td className="py-3 px-4 text-green-400">Present: {presentCount}</td>
                        <td className="py-3 px-4 text-amber-400">Still Checked In: {checkedInCount}</td>
                        <td className="py-3 px-4 text-red-400">Absent: {absentCount}</td>
                        <td className="py-3 px-4 text-cyan">Avg Hours: {avgHoursWorked.toFixed(1)}h</td>
                      </motion.tr>
                    ];
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* Tasks Tab */}
      {activeTab === 'tasks' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <button
            onClick={() => setShowTaskModal(true)}
            className="btn-primary"
          >
            Assign Task
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Todo Column */}
            <div className="glass-card p-6">
              <h3 className="font-bold text-lg mb-4 text-amber">Todo</h3>
              <div className="space-y-3">
                {todo.length === 0 ? (
                  <p className="text-gray-400 text-center py-4">No tasks</p>
                ) : (
                  todo.map((task) => (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="glass-card p-4 border border-gray-700"
                    >
                      <h4 className="font-bold mb-2">{task.title}</h4>
                      <p className="text-sm text-gray-400 mb-3">{task.description}</p>
                      <div className="flex items-center justify-between mb-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(task.priority)}`}>
                          {task.priority}
                        </span>
                        <span className="text-xs text-gray-400">
                          Due: {formatDate(task.dueDate)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-400 mb-3">
                        Assigned to: {employees.find(emp => emp.id === task.assignedTo)?.name || 'Unknown'}
                      </div>
                      <select
                        value={task.status}
                        onChange={(e) => updateTaskStatus(task.id, e.target.value)}
                        className="w-full px-2 py-1 rounded text-sm bg-gray-700 border border-gray-600"
                      >
                        <option value="todo">Todo</option>
                        <option value="in-progress">In Progress</option>
                        <option value="completed">Completed</option>
                      </select>
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="w-full mt-2 text-red-400 hover:text-red-300 text-sm"
                      >
                        Delete
                      </button>
                    </motion.div>
                  ))
                )}
              </div>
            </div>

            {/* In Progress Column */}
            <div className="glass-card p-6">
              <h3 className="font-bold text-lg mb-4 text-blue-400">In Progress</h3>
              <div className="space-y-3">
                {inProgress.length === 0 ? (
                  <p className="text-gray-400 text-center py-4">No tasks</p>
                ) : (
                  inProgress.map((task) => (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="glass-card p-4 border border-gray-700"
                    >
                      <h4 className="font-bold mb-2">{task.title}</h4>
                      <p className="text-sm text-gray-400 mb-3">{task.description}</p>
                      <div className="flex items-center justify-between mb-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(task.priority)}`}>
                          {task.priority}
                        </span>
                        <span className="text-xs text-gray-400">
                          Due: {formatDate(task.dueDate)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-400 mb-3">
                        Assigned to: {employees.find(emp => emp.id === task.assignedTo)?.name || 'Unknown'}
                      </div>
                      <select
                        value={task.status}
                        onChange={(e) => updateTaskStatus(task.id, e.target.value)}
                        className="w-full px-2 py-1 rounded text-sm bg-gray-700 border border-gray-600"
                      >
                        <option value="todo">Todo</option>
                        <option value="in-progress">In Progress</option>
                        <option value="completed">Completed</option>
                      </select>
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="w-full mt-2 text-red-400 hover:text-red-300 text-sm"
                      >
                        Delete
                      </button>
                    </motion.div>
                  ))
                )}
              </div>
            </div>

            {/* Completed Column */}
            <div className="glass-card p-6">
              <h3 className="font-bold text-lg mb-4 text-green-400">Completed</h3>
              <div className="space-y-3">
                {completed.length === 0 ? (
                  <p className="text-gray-400 text-center py-4">No tasks</p>
                ) : (
                  completed.map((task) => (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="glass-card p-4 border border-gray-700 opacity-75"
                    >
                      <h4 className="font-bold mb-2">{task.title}</h4>
                      <p className="text-sm text-gray-400 mb-3">{task.description}</p>
                      <div className="flex items-center justify-between mb-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(task.priority)}`}>
                          {task.priority}
                        </span>
                        <span className="text-xs text-gray-400">
                          Due: {formatDate(task.dueDate)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-400 mb-3">
                        Assigned to: {employees.find(emp => emp.id === task.assignedTo)?.name || 'Unknown'}
                      </div>
                      <select
                        value={task.status}
                        onChange={(e) => updateTaskStatus(task.id, e.target.value)}
                        className="w-full px-2 py-1 rounded text-sm bg-gray-700 border border-gray-600"
                      >
                        <option value="todo">Todo</option>
                        <option value="in-progress">In Progress</option>
                        <option value="completed">Completed</option>
                      </select>
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="w-full mt-2 text-red-400 hover:text-red-300 text-sm"
                      >
                        Delete
                      </button>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Department Attendance Bar Chart */}
            <div className="glass-card p-6">
              <h3 className="font-bold text-lg mb-4 text-gradient">Department Attendance Rate</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={() => {
                  const departments = ['Engineering', 'Marketing', 'HR', 'Finance', 'Operations', 'Design'];
                  return departments.map(dept => {
                    const deptEmployees = employees.filter(emp => emp.department === dept);
                    const todayAttendance = attendanceLogs.filter(log => {
                      const emp = employees.find(e => e.id === log.employeeId);
                      return emp && emp.department === dept && 
                             log.date === new Date().toISOString().split('T')[0];
                    });
                    const percentage = deptEmployees.length > 0 
                      ? Math.round((todayAttendance.length / deptEmployees.length) * 100)
                      : 0;
                    
                    return {
                      department: dept,
                      attendance: percentage
                    };
                  });
                }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="department" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                    labelStyle={{ color: '#9CA3AF' }}
                  />
                  <Bar dataKey="attendance" fill="#00e5ff" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Task Status Pie Chart */}
            <div className="glass-card p-6">
              <h3 className="font-bold text-lg mb-4 text-gradient">Task Status Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Todo', value: todo.length, color: '#F59E0B' },
                      { name: 'In Progress', value: inProgress.length, color: '#3B82F6' },
                      { name: 'Completed', value: completed.length, color: '#10B981' }
                    ]}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {[
                      { name: 'Todo', value: todo.length, color: '#F59E0B' },
                      { name: 'In Progress', value: inProgress.length, color: '#3B82F6' },
                      { name: 'Completed', value: completed.length, color: '#10B981' }
                    ].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                    labelStyle={{ color: '#9CA3AF' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* NEW CHARTS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Average Daily Hours by Department */}
            <div className="glass-card p-6">
              <h3 className="font-bold text-lg mb-4 text-gradient">Average Daily Hours by Department</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={() => {
                  const departments = ['Engineering', 'Marketing', 'HR', 'Finance', 'Operations', 'Design'];
                  return departments.map(dept => {
                    const deptAttendanceLogs = attendanceLogs.filter(log => {
                      const emp = employees.find(e => e.id === log.employeeId);
                      return emp && emp.department === dept && log.workingHours;
                    });
                    
                    const totalHours = deptAttendanceLogs.reduce((sum, log) => {
                      const [hours, minutes] = log.workingHours.replace('h', ' ').replace('m', '').split(' ').map(Number);
                      return sum + hours + (minutes / 60);
                    }, 0);
                    
                    const avgHours = deptAttendanceLogs.length > 0 ? totalHours / deptAttendanceLogs.length : 0;
                    
                    return {
                      department: dept,
                      avgHours: parseFloat(avgHours.toFixed(1))
                    };
                  }).filter(item => item.avgHours > 0);
                }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="department" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                    labelStyle={{ color: '#9CA3AF' }}
                  />
                  <Bar dataKey="avgHours" fill="#00e5ff" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Total Man-Hours Per Day */}
            <div className="glass-card p-6">
              <h3 className="font-bold text-lg mb-4 text-gradient">Total Man-Hours Per Day (Last 14 Days)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={() => {
                  const last14Days = [];
                  for (let i = 13; i >= 0; i--) {
                    const date = new Date();
                    date.setDate(date.getDate() - i);
                    const dateStr = date.toISOString().split('T')[0];
                    
                    const dayAttendance = attendanceLogs.filter(log => 
                      log.date === dateStr && log.workingHours
                    );
                    
                    const totalHours = dayAttendance.reduce((sum, log) => {
                      const [hours, minutes] = log.workingHours.replace('h', ' ').replace('m', '').split(' ').map(Number);
                      return sum + hours + (minutes / 60);
                    }, 0);
                    
                    last14Days.push({
                      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                      totalHours: parseFloat(totalHours.toFixed(1))
                    });
                  }
                  return last14Days;
                }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                    labelStyle={{ color: '#9CA3AF' }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="totalHours" 
                    stroke="#F59E0B" 
                    strokeWidth={2}
                    dot={{ fill: '#F59E0B' }}
                    name="Total Man-Hours"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Daily Attendance Trend Line Chart */}
          <div className="glass-card p-6">
            <h3 className="font-bold text-lg mb-4 text-gradient">Daily Attendance Trend (Last 14 Days)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={() => {
                const last14Days = [];
                for (let i = 13; i >= 0; i--) {
                  const date = new Date();
                  date.setDate(date.getDate() - i);
                  const dateStr = date.toDateString();
                  const dayAttendance = attendanceLogs.filter(log => 
                    new Date(log.date).toDateString() === dateStr
                  ).length;
                  
                  last14Days.push({
                    date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    attendance: dayAttendance
                  });
                }
                return last14Days;
              }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                  labelStyle={{ color: '#9CA3AF' }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="attendance" 
                  stroke="#00e5ff" 
                  strokeWidth={2}
                  dot={{ fill: '#00e5ff' }}
                  name="Present Employees"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-card p-6">
              <h3 className="font-bold text-lg mb-4 text-gradient">Task Statistics</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Tasks</span>
                  <span className="font-bold">{tasks.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Completion Rate</span>
                  <span className="font-bold text-green-400">
                    {tasks.length > 0 ? Math.round((completed.length / tasks.length) * 100) : 0}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">High Priority</span>
                  <span className="font-bold text-red-400">
                    {tasks.filter(t => t.priority === 'high').length}
                  </span>
                </div>
              </div>
            </div>

            <div className="glass-card p-6">
              <h3 className="font-bold text-lg mb-4 text-gradient">Employee Statistics</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Employees</span>
                  <span className="font-bold">{employees.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Present Today</span>
                  <span className="font-bold text-green-400">{stats.presentToday}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Departments</span>
                  <span className="font-bold text-cyan">
                    {[...new Set(employees.map(emp => emp.department))].length}
                  </span>
                </div>
              </div>
            </div>

            <div className="glass-card p-6">
              <h3 className="font-bold text-lg mb-4 text-gradient">System Health</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Active Sessions</span>
                  <span className="font-bold text-green-400">1</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Storage Used</span>
                  <span className="font-bold text-amber">~2MB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">System Status</span>
                  <span className="font-bold text-green-400">Healthy</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Task Modal */}
      <AnimatePresence>
        {showTaskModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            onClick={() => setShowTaskModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-gradient mb-4">Assign New Task</h3>
              <form onSubmit={createTask} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Title</label>
                  <input
                    type="text"
                    required
                    value={taskForm.title}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, title: e.target.value }))}
                    className="input-field"
                    placeholder="Task title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                  <textarea
                    required
                    value={taskForm.description}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, description: e.target.value }))}
                    className="input-field"
                    rows="3"
                    placeholder="Task description"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Assign To</label>
                  <select
                    required
                    value={taskForm.assignedTo}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, assignedTo: e.target.value }))}
                    className="input-field"
                  >
                    <option value="">Select Employee</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} - {emp.department}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Priority</label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, priority: e.target.value }))}
                    className="input-field"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Due Date</label>
                  <input
                    type="date"
                    required
                    value={taskForm.dueDate}
                    onChange={(e) => setTaskForm(prev => ({ ...prev, dueDate: e.target.value }))}
                    className="input-field"
                  />
                </div>
                <div className="flex space-x-3">
                  <button type="submit" className="btn-primary flex-1">
                    Assign Task
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowTaskModal(false)}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Employee Detail Modal */}
      <AnimatePresence>
        {showEmployeeModal && selectedEmployee && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            onClick={() => setShowEmployeeModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-xl font-bold text-gradient">Employee Details</h3>
                <button
                  onClick={() => setShowEmployeeModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-6">
                <div className="flex items-center space-x-4">
                  <div className="w-20 h-20 bg-gradient-to-br from-cyan to-amber rounded-full flex items-center justify-center">
                    <span className="text-black font-bold text-2xl">
                      {selectedEmployee.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-lg font-bold">{selectedEmployee.name}</h4>
                    <p className="text-gray-400">{selectedEmployee.jobTitle}</p>
                    <p className="text-sm text-gray-500">{selectedEmployee.department}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-400">Email</p>
                    <p className="font-medium">{selectedEmployee.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Registered</p>
                    <p className="font-medium">{formatDate(selectedEmployee.registeredAt)}</p>
                  </div>
                </div>

                <div>
                  <h5 className="font-bold mb-3">Recent Attendance</h5>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {attendanceLogs
                      .filter(log => log.employeeId === selectedEmployee.id)
                      .slice(0, 10)
                      .map(log => (
                        <div key={log.id} className="flex justify-between text-sm p-2 bg-gray-800/50 rounded">
                          <span>{formatDate(log.date)}</span>
                          <span className="text-green-400">{formatTime(log.checkInTime)}</span>
                        </div>
                      ))}
                  </div>
                </div>

                <div>
                  <h5 className="font-bold mb-3">Assigned Tasks</h5>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {tasks
                      .filter(task => task.assignedTo === selectedEmployee.id)
                      .slice(0, 10)
                      .map(task => (
                        <div key={task.id} className="p-2 bg-gray-800/50 rounded">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">{task.title}</p>
                              <p className="text-xs text-gray-400">{task.description}</p>
                            </div>
                            <span className={`px-2 py-1 rounded text-xs ${getPriorityColor(task.priority)}`}>
                              {task.priority}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminDashboard;
