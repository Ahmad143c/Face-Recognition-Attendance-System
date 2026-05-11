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
    <div className="min-h-screen bg-charcoal mobile-full-height">
      {/* Header */}
      <div className="mobile-header safe-area-top">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan to-amber rounded-full flex items-center justify-center">
                <span className="text-black font-bold text-lg">F</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-gradient">FACEMARK</h1>
            </div>
            <div className="flex items-center space-x-2">
              <Link to="/dashboard" className="btn-secondary-sm">
                <span className="hidden sm:inline">Dashboard</span>
                <span className="sm:hidden">🏠</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <div className="grid lg:grid-cols-2 gap-6 lg:gap-8 items-start">
          {/* Left Column - Camera and Controls */}
          <div className="order-2 lg:order-1">
            <div className="glass-card p-4 sm:p-6">
              <div className="text-center mb-4 sm:mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-gradient mb-2">Mark Attendance</h2>
                <p className="text-gray-400 text-sm sm:text-base">Use face recognition to check in or out</p>
              </div>

              {/* Camera Status Pill */}
              <div className="flex justify-center mb-4 sm:mb-6">
                <div className={`px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-medium border ${
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

              {/* Camera Container */}
              <div className="mobile-camera-container mb-4 sm:mb-6">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover rounded-lg border border-gray-700"
                />
                <canvas
                  ref={canvasRef}
                  className="absolute top-0 left-0 w-full h-full rounded-lg"
                />

                {/* Mobile camera overlay */}
                <div className="mobile-camera-overlay">
                  <div className="absolute inset-0 border-2 border-cyan/30 rounded-lg pointer-events-none">
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 sm:w-40 sm:h-40 border-2 border-cyan rounded-full opacity-50"></div>
                  </div>
                </div>
              </div>

              {/* Control Buttons */}
              <div className="space-y-3 sm:space-y-4">
                <div className="flex justify-center">
                  {!isScanning ? (
                    <button onClick={startScanning} className="btn-primary w-full sm:w-auto">
                      <span className="hidden sm:inline">Start Face Scan</span>
                      <span className="sm:hidden">Start Scan</span>
                    </button>
                  ) : (
                    <button onClick={stopScanning} className="btn-danger w-full sm:w-auto">
                      <span className="hidden sm:inline">Stop Scanning</span>
                      <span className="sm:hidden">Stop</span>
                    </button>
                  )}
                </div>

                {/* Scanning Status */}
                {isScanning && (
                  <div className="text-center">
                    <div className="inline-block animate-pulse">
                      <div className="w-3 h-3 bg-cyan rounded-full"></div>
                    </div>
                    <p className="text-cyan mt-2 text-xs sm:text-sm">Scanning for face...</p>
                    <p className="text-gray-400 text-xs mt-1">Position your face in the frame</p>
                  </div>
                )}

                {/* Manual Login Option */}
                <div className="text-center">
                  <Link to="/login" className="text-cyan hover:text-cyan/80 text-xs sm:text-sm transition-colors">
                    Or login manually
                  </Link>
                </div>
              </div>
            </div>

            {/* Mobile Instructions */}
            <div className="lg:hidden mt-4">
              <div className="mobile-card">
                <h3 className="font-bold text-cyan mb-2">Quick Tips</h3>
                <ul className="text-xs text-gray-400 space-y-1">
                  <li>• Ensure good lighting</li>
                  <li>• Position face in the circle</li>
                  <li>• Keep camera steady</li>
                  <li>• Remove glasses if needed</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Right Column - Status and Info */}
          <div className="order-1 lg:order-2">
            <div className="glass-card p-4 sm:p-6">
              <h3 className="text-lg sm:text-xl font-bold text-gradient mb-4">Attendance Status</h3>

              {/* Status Display */}
              <div className="space-y-4">
                {attendanceStatus && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-3 sm:p-4 rounded-lg border ${
                      attendanceStatus.type === 'success' 
                        ? 'bg-green-500/20 border-green-500/50'
                        : attendanceStatus.type === 'error'
                        ? 'bg-red-500/20 border-red-500/50'
                        : 'bg-amber-500/20 border-amber-500/50'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center ${
                        attendanceStatus.type === 'success' 
                          ? 'bg-green-500'
                          : attendanceStatus.type === 'error'
                          ? 'bg-red-500'
                          : 'bg-amber-500'
                      }`}>
                        {attendanceStatus.type === 'success' && (
                          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                        {attendanceStatus.type === 'error' && (
                          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        )}
                        {attendanceStatus.type === 'warning' && (
                          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-sm sm:text-base">{attendanceStatus.title}</p>
                        <p className="text-xs sm:text-sm text-gray-300">{attendanceStatus.message}</p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Today's Session Info */}
                {currentSession && currentSession !== 'none' && (
                  <div className="mobile-card">
                    <h4 className="font-bold text-cyan mb-2">Today's Session</h4>
                    <div className="space-y-1 text-xs sm:text-sm">
                      {currentSession.checkInTime && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Check In:</span>
                          <span className="text-white">{formatTime(currentSession.checkInTime)}</span>
                        </div>
                      )}
                      {currentSession.checkOutTime && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Check Out:</span>
                          <span className="text-white">{formatTime(currentSession.checkOutTime)}</span>
                        </div>
                      )}
                      {currentSession.workingHours && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Hours:</span>
                          <span className="text-white">{currentSession.workingHours}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Instructions */}
                <div className="hidden lg:block">
                  <h4 className="font-bold text-cyan mb-2">Instructions</h4>
                  <ul className="text-sm text-gray-400 space-y-1">
                    <li>• Ensure good lighting</li>
                    <li>• Position face in the circle</li>
                    <li>• Keep camera steady</li>
                    <li>• Remove glasses if needed</li>
                    <li>• Wait for recognition</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* System Status */}
            <div className="glass-card p-4 sm:p-6 mt-4 sm:mt-6">
              <h3 className="text-lg sm:text-xl font-bold text-gradient mb-4">System Status</h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Face Recognition:</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    modelsLoaded ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {modelsLoaded ? 'Active' : 'Loading...'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Camera:</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    isVideoReady ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {isVideoReady ? 'Ready' : 'Not Ready'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Scanning:</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    isScanning ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-500/20 text-gray-400'
                  }`}>
                    {isScanning ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Attendance;
