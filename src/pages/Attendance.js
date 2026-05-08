import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import * as faceapi from 'face-api.js';
import { v4 as uuidv4 } from 'uuid';

const Attendance = () => {
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [matchedEmployee, setMatchedEmployee] = useState(null);
  const [attendanceStatus, setAttendanceStatus] = useState(null);
  const [currentSession, setCurrentSession] = useState(null);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loginErrors, setLoginErrors] = useState({});
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  
  const navigate = useNavigate();
  const { login } = useAuth();
  const { addToast } = useToast();

  // Helper function to calculate working hours
  const calcWorkingHours = (checkInTime, checkOutTime) => {
    const [inH, inM, inS] = checkInTime.split(":").map(Number);
    const [outH, outM, outS] = checkOutTime.split(":").map(Number);
    let totalSeconds = (outH * 3600 + outM * 60 + outS) - (inH * 3600 + inM * 60 + inS);
    if (totalSeconds < 0) totalSeconds += 86400; // overnight shift support
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  // Helper function to get current time in HH:MM:SS format
  const getCurrentTime = () => {
    const now = new Date();
    return now.toTimeString().split(' ')[0];
  };

  // Helper function to get current date in YYYY-MM-DD format
  const getCurrentDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  // Helper function to migrate old attendance logs
  const migrateAttendanceLogs = (logs) => {
    return logs.map(log => ({
      ...log,
      checkOutTime: log.checkOutTime || null,
      workingHours: log.workingHours || null,
      date: log.date || new Date(log.date || new Date()).toISOString().split('T')[0]
    }));
  };

  // Helper function to get today's session status
  const getTodaySession = React.useCallback((employeeId) => {
    const attendanceLogs = JSON.parse(localStorage.getItem('attendance_logs') || '[]');
    const migratedLogs = migrateAttendanceLogs(attendanceLogs);
    const todayDate = getCurrentDate();
    
    return migratedLogs.find(log => 
      log.employeeId === employeeId && log.date === todayDate
    );
  }, []);

  const startVideo = React.useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480 } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        
        // Wait for video metadata to load before setting as ready
        videoRef.current.onloadedmetadata = () => {
          setIsVideoReady(true);
        };
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      addToast('Failed to access camera. Please check permissions.', 'error');
    }
  }, [addToast]);

  const loadFaceApiModels = React.useCallback(async () => {
    try {
      addToast('Loading face recognition models...', 'info', 0);
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model'),
        faceapi.nets.faceLandmark68Net.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model'),
        faceapi.nets.faceRecognitionNet.loadFromUri('https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model')
      ]);
      setModelsLoaded(true);
      addToast('Models loaded successfully', 'success', 2000);
      startVideo();
    } catch (error) {
      console.error('Error loading models:', error);
      addToast('Failed to load face recognition models', 'error');
    }
  }, [addToast, startVideo]);

  useEffect(() => {
    loadFaceApiModels();
    
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [loadFaceApiModels]);

  const startScanning = React.useCallback(() => {
    setIsScanning(true);
    setMatchedEmployee(null);
    setAttendanceStatus(null);
  }, []);

  const stopScanning = React.useCallback(() => {
    setIsScanning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  }, []);

  const markAttendance = React.useCallback(async (employee) => {
    try {
      const attendanceLogs = JSON.parse(localStorage.getItem('attendance_logs') || '[]');
      const migratedLogs = migrateAttendanceLogs(attendanceLogs);
      const todayDate = getCurrentDate();
      const currentTime = getCurrentTime();
      
      // STEP 1: Query today's record for the matched employee
      const todayLog = getTodaySession(employee.id);

      // STEP 2: Determine mode and act
      if (!todayLog) {
        // CASE A: No record today
        const newLog = {
          id: uuidv4(),
          employeeId: employee.id,
          employeeName: employee.name,
          department: employee.department,
          date: todayDate,
          checkInTime: currentTime,
          checkOutTime: null,
          workingHours: null,
          status: 'checked-in'
        };

        migratedLogs.push(newLog);
        localStorage.setItem('attendance_logs', JSON.stringify(migratedLogs));
        
        setAttendanceStatus({
          type: 'checkin',
          message: `✓ Checked In at ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`,
          employee
        });
        setCurrentSession('checked-in');
        addToast('Successfully checked in!', 'success');
        
      } else if (todayLog.checkOutTime === null) {
        // CASE B: Record exists, checkOutTime is null (employee is still checked in)
        
        // Guard: minimum 1 minute session
        const checkInTime = todayLog.checkInTime;
        const [checkInH, checkInM] = checkInTime.split(":").map(Number);
        const [currentH, currentM] = currentTime.split(":").map(Number);
        const totalMinutes = (currentH * 60 + currentM) - (checkInH * 60 + checkInM);
        
        if (totalMinutes < 1) {
          addToast('Too soon to check out. Minimum session is 1 minute.', 'error');
          setAttendanceStatus({
            type: 'error',
            message: 'Too soon to check out. Minimum session is 1 minute.',
            employee
          });
          return;
        }
        
        // Update existing log
        const workingHours = calcWorkingHours(checkInTime, currentTime);
        const updatedLog = {
          ...todayLog,
          checkOutTime: currentTime,
          workingHours: workingHours,
          status: 'present'
        };
        
        const logIndex = migratedLogs.findIndex(log => log.id === todayLog.id);
        migratedLogs[logIndex] = updatedLog;
        localStorage.setItem('attendance_logs', JSON.stringify(migratedLogs));
        
        setAttendanceStatus({
          type: 'checkout',
          message: `✓ Checked Out at ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} — ${workingHours} worked`,
          employee
        });
        setCurrentSession('complete');
        addToast('Successfully checked out!', 'success');
        
      } else {
        // CASE C: Record exists, checkOutTime is NOT null (session complete)
        setAttendanceStatus({
          type: 'complete',
          message: 'Session Complete for Today',
          employee
        });
        setCurrentSession('complete');
        addToast('Session already completed for today!', 'info');
        return;
      }

      // Automatically log in the user after face recognition
      login({ 
        userId: employee.id, 
        role: employee.role || 'employee', 
        name: employee.name, 
        email: employee.email 
      });
      
      // Redirect to appropriate dashboard based on role
      addToast(`Welcome back, ${employee.name}! Redirecting to dashboard...`, 'success');
      
      // Delay redirect to show success message
      setTimeout(() => {
        if (employee.role === 'admin') {
          navigate('/admin-dashboard');
        } else {
          navigate('/dashboard');
        }
      }, 1500);
      
    } catch (error) {
      console.error('Error marking attendance:', error);
      addToast('Failed to mark attendance', 'error');
    }
  }, [addToast, login, navigate, getTodaySession]);

  const recognizeFace = React.useCallback(async () => {
    if (!modelsLoaded || !isVideoReady || !isScanning || !videoRef.current || !canvasRef.current) return;

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Additional safety checks
      if (!video || !canvas || !video.videoWidth || !video.videoHeight) return;

      // Set explicit dimensions if not already set
      if (!video.width) video.width = 640;
      if (!video.height) video.height = 480;

      const detections = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      const displaySize = { width: video.width || 640, height: video.height || 480 };
      faceapi.matchDimensions(canvas, displaySize);

      if (detections) {
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        const context = canvas.getContext('2d');
        if (context) {
          context.clearRect(0, 0, canvas.width, canvas.height);
          faceapi.draw.drawDetections(canvas, resizedDetections);
          faceapi.draw.drawFaceLandmarks(canvas, resizedDetections);
        }

        // Get registered employees
        const employees = JSON.parse(localStorage.getItem('emp_users') || '[]');
        
        if (employees.length > 0) {
          const labeledDescriptors = employees.map(emp => 
            new faceapi.LabeledFaceDescriptors(emp.id, [new Float32Array(emp.faceDescriptor)])
          );
          
          const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.5);
          const match = faceMatcher.findBestMatch(resizedDetections.descriptor);

          if (match.label !== 'unknown') {
            const employee = employees.find(emp => emp.id === match.label);
            if (employee) {
              setMatchedEmployee(employee);
              await markAttendance(employee);
              stopScanning();
            }
          }
        }
      } else {
        const context = canvas.getContext('2d');
        if (context) {
          context.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
    } catch (error) {
      console.error('Error recognizing face:', error);
    }
  }, [modelsLoaded, isVideoReady, isScanning, markAttendance, stopScanning]);

  useEffect(() => {
    if (isScanning && modelsLoaded && isVideoReady) {
      intervalRef.current = setInterval(recognizeFace, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isScanning, modelsLoaded, isVideoReady, recognizeFace]);

  const handleManualLogin = (e) => {
    e.preventDefault();
    const errors = {};
    
    if (!loginForm.email.trim()) errors.email = 'Email is required';
    if (!loginForm.password) errors.password = 'Password is required';
    
    if (Object.keys(errors).length > 0) {
      setLoginErrors(errors);
      return;
    }

    const employees = JSON.parse(localStorage.getItem('emp_users') || '[]');
    const user = employees.find(emp => 
      emp.email === loginForm.email && emp.password === loginForm.password
    );

    if (user) {
      login({ 
        userId: user.id, 
        role: user.role, 
        name: user.name, 
        email: user.email 
      });
      addToast('Login successful!', 'success');
      navigate('/dashboard');
    } else {
      setLoginErrors({ general: 'Invalid email or password' });
      addToast('Invalid credentials', 'error');
    }
  };

  const handleLoginInputChange = (e) => {
    const { name, value } = e.target;
    setLoginForm(prev => ({ ...prev, [name]: value }));
    if (loginErrors[name]) {
      setLoginErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  return (
    <div className="min-h-screen py-12 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto"
      >
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gradient mb-4">Mark Attendance</h1>
          <p className="text-gray-400">Use face recognition or manual login to mark your attendance</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Face Recognition Section */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card p-6"
          >
            <h2 className="text-xl font-bold mb-4 text-gradient">Face Recognition</h2>
            
            {!modelsLoaded && (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-cyan"></div>
                <p className="mt-4 text-gray-400">Loading face recognition models...</p>
              </div>
            )}

            {modelsLoaded && (
              <div className="space-y-4">
                {/* Camera UI Status Pill */}
                <div className="flex justify-center mb-4">
                  <div className={`px-4 py-2 rounded-full text-sm font-medium border ${
                    currentSession === 'checked-in' 
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                      : currentSession === 'complete'
                      ? 'bg-gray-500/20 text-gray-400 border-gray-500/50'
                      : 'bg-cyan/20 text-cyan border-cyan/50'
                  }`}>
                    {currentSession === 'checked-in' ? 'READY TO CHECK OUT' : 
                     currentSession === 'complete' ? 'SESSION COMPLETE' : 
                     'READY TO CHECK IN'}
                  </div>
                </div>
                
                <div className="relative inline-block">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    width="640"
                    height="480"
                    className="w-full rounded-lg border border-gray-700"
                  />
                  <canvas
                    ref={canvasRef}
                    width="640"
                    height="480"
                    className="absolute top-0 left-0 w-full rounded-lg"
                  />
                </div>

                <div className="flex justify-center">
                  {!isScanning ? (
                    <button onClick={startScanning} className="btn-primary">
                      Start Face Scan
                    </button>
                  ) : (
                    <button onClick={stopScanning} className="btn-danger">
                      Stop Scanning
                    </button>
                  )}
                </div>

                {isScanning && (
                  <div className="text-center">
                    <div className="inline-block animate-pulse">
                      <div className="w-3 h-3 bg-cyan rounded-full"></div>
                    </div>
                    <p className="text-cyan mt-2">Scanning for face...</p>
                  </div>
                )}

                {matchedEmployee && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-card p-4 border border-cyan/50"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-cyan to-amber rounded-full flex items-center justify-center">
                        <span className="text-black font-bold">
                          {matchedEmployee.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-bold">{matchedEmployee.name}</p>
                        <p className="text-sm text-gray-400">{matchedEmployee.department}</p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {attendanceStatus && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`glass-card p-4 border ${
                      attendanceStatus.type === 'checkin' 
                        ? 'border-green-500/50 bg-green-500/10' 
                        : attendanceStatus.type === 'checkout'
                        ? 'border-blue-500/50 bg-blue-500/10'
                        : attendanceStatus.type === 'complete'
                        ? 'border-amber-500/50 bg-amber-500/10'
                        : attendanceStatus.type === 'error'
                        ? 'border-red-500/50 bg-red-500/10'
                        : 'border-gray-500/50 bg-gray-500/10'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        {attendanceStatus.type === 'checkin' ? (
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        ) : attendanceStatus.type === 'checkout' ? (
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        ) : attendanceStatus.type === 'complete' ? (
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        ) : attendanceStatus.type === 'error' ? (
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        ) : (
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        )}
                      </svg>
                      <div className="flex-1">
                        <p className={`font-medium ${
                          attendanceStatus.type === 'checkin' ? 'text-green-400' 
                          : attendanceStatus.type === 'checkout'
                          ? 'text-blue-400'
                          : attendanceStatus.type === 'complete'
                          ? 'text-amber-400'
                          : attendanceStatus.type === 'error'
                          ? 'text-red-400'
                          : 'text-gray-400'
                        }`}>
                          {attendanceStatus.message}
                        </p>
                        {(attendanceStatus.type === 'checkin' || attendanceStatus.type === 'checkout') && (
                          <p className="text-sm text-gray-400 mt-1 flex items-center">
                            <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Automatically logging in and redirecting to dashboard...
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {!isScanning && !matchedEmployee && (
                  <p className="text-gray-400 text-sm text-center">
                    Click "Start Face Scan" to begin face recognition
                  </p>
                )}
              </div>
            )}
          </motion.div>

          {/* Manual Login Section */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="glass-card p-6"
          >
            <h2 className="text-xl font-bold mb-4 text-gradient">Manual Login</h2>
            
            <form onSubmit={handleManualLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                <input
                  type="email"
                  name="email"
                  value={loginForm.email}
                  onChange={handleLoginInputChange}
                  className={`input-field ${loginErrors.email ? 'border-red-500' : ''}`}
                  placeholder="Enter your email"
                />
                {loginErrors.email && <p className="text-red-400 text-sm mt-1">{loginErrors.email}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
                <input
                  type="password"
                  name="password"
                  value={loginForm.password}
                  onChange={handleLoginInputChange}
                  className={`input-field ${loginErrors.password ? 'border-red-500' : ''}`}
                  placeholder="Enter your password"
                />
                {loginErrors.password && <p className="text-red-400 text-sm mt-1">{loginErrors.password}</p>}
              </div>

              {loginErrors.general && (
                <div className="glass-card p-3 border border-red-500/50">
                  <p className="text-red-400 text-sm">{loginErrors.general}</p>
                </div>
              )}

              <button type="submit" className="w-full btn-primary">
                Login
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-gray-400 text-sm">
                Don't have an account?{' '}
                <Link to="/register" className="text-cyan hover:text-cyan/80 transition-colors">
                  Register here
                </Link>
              </p>
            </div>

            <div className="mt-6 p-4 glass-card border border-gray-700">
              <h3 className="font-bold mb-2 text-amber">Admin Access</h3>
              <p className="text-sm text-gray-400 mb-2">
                For admin dashboard, use:
              </p>
              <div className="text-xs bg-charcoal-light p-2 rounded">
                <p>Email: admin@company.com</p>
                <p>Password: Admin@123</p>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

export default Attendance;
