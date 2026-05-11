import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const Landing = () => {
  return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center overflow-hidden mobile-full-height">
      {/* Login Button - Top Right */}
      <div className="fixed top-4 right-4 z-50">
        <Link 
          to="/login" 
          className="glass-card px-4 py-2 sm:px-6 text-cyan hover:text-cyan/80 transition-all hover:scale-105 flex items-center text-sm sm:text-base"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4 4m-4-4h4m-4 4v4m4-4v4m2-12h8a2 2 0 012 2v8a2 2 0 01-2 2h-8a2 2 0 01-2-2V6a2 2 0 012-2z" />
          </svg>
          <span className="hidden sm:inline">Login</span>
          <span className="sm:hidden">👤</span>
        </Link>
      </div>
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-8 lg:gap-12 items-center max-w-7xl">
        {/* Left Content */}
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center lg:text-left order-2 lg:order-1 mt-8 lg:mt-0"
        >
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-mono font-bold mb-4 sm:mb-6"
          >
            <span className="text-gradient">FACEMARK</span>
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="text-lg sm:text-xl lg:text-2xl text-gray-300 mb-6 sm:mb-8 font-medium px-4 sm:px-0"
          >
            Biometric Attendance & Workforce Management
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8 }}
            className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start mb-8 sm:mb-12 px-4 sm:px-0"
          >
            <Link to="/register" className="btn-primary text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 w-full sm:w-auto justify-center">
              Register Employee
            </Link>
            <Link to="/attendance" className="btn-secondary text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 w-full sm:w-auto justify-center">
              Mark Attendance
            </Link>
          </motion.div>
          
          {/* Mobile Features */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.8 }}
            className="lg:hidden grid grid-cols-2 gap-4 px-4"
          >
            <div className="mobile-card">
              <div className="text-cyan mb-2">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="font-bold text-white mb-1">Secure</h3>
              <p className="text-gray-400 text-sm">Face recognition technology</p>
            </div>
            
            <div className="mobile-card">
              <div className="text-amber mb-2">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-bold text-white mb-1">Fast</h3>
              <p className="text-gray-400 text-sm">Instant check-in/out</p>
            </div>
            
            <div className="mobile-card">
              <div className="text-green-400 mb-2">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="font-bold text-white mb-1">Analytics</h3>
              <p className="text-gray-400 text-sm">Detailed reports</p>
            </div>
            
            <div className="mobile-card">
              <div className="text-purple-400 mb-2">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="font-bold text-white mb-1">Mobile</h3>
              <p className="text-gray-400 text-sm">Works on all devices</p>
            </div>
          </motion.div>
        </motion.div>

        {/* Right Animation */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="relative order-1 lg:order-2"
        >
          <div className="relative w-full h-64 sm:h-80 md:h-96 flex items-center justify-center">
            {/* Animated concentric circles */}
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="absolute w-32 h-32 sm:w-48 sm:h-48 md:w-64 md:h-64 border-2 border-cyan/30 rounded-full"
            />
            <motion.div
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
              className="absolute w-32 h-32 sm:w-48 sm:h-48 md:w-64 md:h-64 border-2 border-cyan/20 rounded-full"
            />
            <motion.div
              animate={{ scale: [1, 1.4, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              className="absolute w-32 h-32 sm:w-48 sm:h-48 md:w-64 md:h-64 border-2 border-cyan/10 rounded-full"
            />
            
            {/* Face silhouette */}
            <motion.div
              animate={{ rotateY: [0, 360] }}
              transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
              className="relative z-10"
            >
              <svg width="200" height="200" viewBox="0 0 200 200" className="w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40 lg:w-48 lg:h-48">
                <circle cx="100" cy="100" r="80" fill="none" stroke="url(#gradient)" strokeWidth="2" opacity="0.8"/>
                <circle cx="75" cy="85" r="8" fill="url(#gradient)" opacity="0.8"/>
                <circle cx="125" cy="85" r="8" fill="url(#gradient)" opacity="0.8"/>
                <path d="M 70 120 Q 100 140 130 120" fill="none" stroke="url(#gradient)" strokeWidth="2" opacity="0.8"/>
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#00e5ff"/>
                    <stop offset="100%" stopColor="#ffaa00"/>
                  </linearGradient>
                </defs>
              </svg>
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* Feature Cards */}
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8, duration: 0.8 }}
        className="container mx-auto px-4 mt-16"
      >
        <div className="grid md:grid-cols-3 gap-8">
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="glass-card p-6 text-center"
          >
            <div className="w-16 h-16 bg-cyan/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-2 text-gradient">Face Recognition</h3>
            <p className="text-gray-400">Advanced biometric technology for accurate and secure attendance tracking</p>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.05 }}
            className="glass-card p-6 text-center"
          >
            <div className="w-16 h-16 bg-amber/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-amber" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-2 text-gradient">Task Management</h3>
            <p className="text-gray-400">Comprehensive task assignment and tracking system for workforce productivity</p>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.05 }}
            className="glass-card p-6 text-center"
          >
            <div className="w-16 h-16 bg-cyan/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-cyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold mb-2 text-gradient">Real-time Analytics</h3>
            <p className="text-gray-400">Detailed insights and reports on attendance patterns and workforce metrics</p>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

export default Landing;
