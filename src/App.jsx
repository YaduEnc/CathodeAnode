import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, ShieldCheck, Sparkles, Zap, MessageCircle, ArrowRight, Mail, AlertCircle, Instagram, Twitter, Github, User, BookOpen, School, Phone, Calendar, Hash, Camera, Settings, LogOut, Search, UserCircle, X, Check } from 'lucide-react';
import { supabase } from './supabase';

/**
 * University-Only Live Conversation Platform
 * Production App - Cheerful Pink Theme
 */

const App = () => {
  const [view, setView] = useState('landing'); // 'landing', 'auth-signup', 'auth-login', 'onboarding', 'dashboard', 'profile', 'about'
  const [session, setSession] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [activeChat, setActiveChat] = useState(null);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isInitialMount = useRef(true);

  useEffect(() => {
    // 1. Single Auth Listener (handles INITIAL_SESSION and all changes)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth Event:", event, session?.user?.email);
      setSession(session);

      if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        await fetchProfile(session.user.id);
      } else if (!session) {
        setUserProfile(null);
        setActiveChat(null);
        if (event === 'SIGNED_OUT') setView('landing');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // 2. Stable Chat Subscription
  useEffect(() => {
    if (!session?.user?.id) return;

    console.log("Setting up Realtime for:", session.user.id);
    const chatSubscription = supabase
      .channel(`user-chats-${session.user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chats',
        filter: `user1_id=eq.${session.user.id}`
      }, payload => {
        console.log("Incoming Chat (U1):", payload.new);
        setActiveChat(payload.new);
        setView('chat');
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chats',
        filter: `user2_id=eq.${session.user.id}`
      }, payload => {
        console.log("Incoming Chat (U2):", payload.new);
        setActiveChat(payload.new);
        setView('chat');
      })
      .subscribe((status) => {
        console.log("Realtime Status:", status);
      });

    return () => {
      console.log("Cleaning up Realtime");
      supabase.removeChannel(chatSubscription);
    };
  }, [session?.user?.id]);

  const fetchProfile = async (userId) => {
    try {
      console.log("Fetching profile for:", userId);
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle(); // maybeSingle is safer for 406/404 issues

      if (error) {
        console.error("Supabase Profile Error:", error);
        // If 406, check if table exists or if RLS is broken
        if (error.code === 'PGRST106') {
          console.warn("Possible schema mismatch or table missing.");
        }
        setView('onboarding');
        return;
      }

      if (profile) {
        console.log("Profile found:", profile.name);
        setUserProfile(profile);
        setView('dashboard');
      } else {
        console.log("No profile found, redirecting to onboarding");
        setView('onboarding');
      }
    } catch (err) {
      console.error("Critical Profile Fetch Error:", err);
      setView('onboarding');
    }
  };

  // Email Sign-up/Login Logic
  const handleEmailAuth = async (e, type) => {
    e.preventDefault();
    setError('');

    const domain = '@gbu.ac.in';
    if (!email.toLowerCase().endsWith(domain)) {
      setError(`Only ${domain} emails are allowed for campus safety.`);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          shouldCreateUser: type === 'signup',
          emailRedirectTo: window.location.origin,
        }
      });

      if (error) throw error;
      setView('auth-sent');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-wrapper">
      <AnimatePresence mode="wait">
        {loading && !session ? (
          <div className="loading-screen" key="loading">
            <Sparkles className="spin" size={40} color="var(--accent-pink)" />
          </div>
        ) : (
          !session ? (
            view === 'landing' ? (
              <LandingView
                key="landing"
                onJoin={() => setView('auth-signup')}
                onLogin={() => setView('auth-login')}
                setView={setView}
              />
            ) : view === 'about' ? (
              <AboutView key="about" onBack={() => setView('landing')} />
            ) : (view === 'auth-signup' || view === 'auth-login') ? (
              <AuthView
                key="auth"
                type={view === 'auth-signup' ? 'signup' : 'login'}
                email={email}
                setEmail={setEmail}
                error={error}
                loading={loading}
                onSubmit={(e) => handleEmailAuth(e, view === 'auth-signup' ? 'signup' : 'login')}
                onBack={() => setView('landing')}
                onSwitch={() => setView(view === 'auth-signup' ? 'auth-login' : 'auth-signup')}
              />
            ) : view === 'auth-sent' ? (
              <AuthSentView
                key="auth-sent"
                email={email}
                onBack={() => setView('auth-login')}
              />
            ) : null
          ) : (
            (view === 'onboarding' || !userProfile) ? (
              <OnboardingView
                key="onboarding"
                session={session}
                onComplete={() => fetchProfile(session.user.id)}
              />
            ) : view === 'dashboard' ? (
              <DashboardView
                key="dashboard"
                profile={userProfile}
                onGoToProfile={() => setView('profile')}
                onLogout={() => supabase.auth.signOut()}
              />
            ) : view === 'profile' ? (
              <ProfileView
                key="profile"
                profile={userProfile}
                onBack={() => setView('dashboard')}
                onUpdate={async () => await fetchProfile(session.user.id)}
              />
            ) : view === 'chat' ? (
              <ChatView
                key="chat"
                profile={userProfile}
                chat={activeChat}
                onClose={() => {
                  setActiveChat(null);
                  setView('dashboard');
                }}
              />
            ) : null
          )
        )}
      </AnimatePresence>
    </div>
  );
};

/* --- Sub-Components --- */

const LandingView = ({ onJoin, onLogin, setView }) => {
  return (
    <div className="landing-wrapper">
      <div className="pink-gradient-bg">
        <div className="pink-orb orb-1"></div>
        <div className="pink-orb orb-2"></div>
        <div className="pink-orb orb-3"></div>
      </div>

      <nav className="main-nav glass-card">
        <div className="container nav-flex">
          <div className="logo-area">
            <Heart size={24} fill="var(--accent-pink)" className="heart-icon" />
            <span className="logo-text">CathodeAnode</span>
          </div>
          <div className="nav-links">
            <button className="nav-link-btn" onClick={() => setView('about')}>About</button>
            <a href="#features">Features</a>
          </div>
          <div className="nav-auth">
            <button className="btn-secondary" onClick={onLogin}>Log In</button>
            <button className="btn-primary" onClick={onJoin}>Join Now</button>
          </div>
        </div>
      </nav>

      <header className="hero">
        <div className="container hero-grid">
          <motion.div
            className="hero-content"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className="badge">
              <Sparkles size={14} /> <span>No Cap, Only Verified Students</span>
            </div>
            <h1 className="hero-title">
              Catch the <span className="gradient-text">Anode</span> of Your <br />
              Campus Soulmate
            </h1>
            <p className="hero-subtitle">
              "Main Character Energy" only. The safest, edgiest way to connect with students from your uni.
              Real-time, ephemeral, and 100% consent-driven.
            </p>
            <div className="hero-btns">
              <button className="btn-primary large" onClick={onJoin}>
                Join the Circle <ArrowRight size={20} />
              </button>
            </div>
            <div className="hero-quotes">
              <span className="quote">"It's giving soulmate ✨"</span>
              <span className="quote">"No more dry texts 🙅‍♀️"</span>
              <span className="quote">"LIT matches only 🔥"</span>
            </div>
          </motion.div>

          <div className="hero-visual">
            <div className="visual-card glass-card float">
              <div className="card-header">
                <div className="avatar"></div>
                <div className="name-line"></div>
              </div>
              <div className="card-body">
                <div className="msg msg-1">Hey! Love your bio ✨</div>
                <div className="msg msg-2">Thanks! Coffee tomorrow? ☕</div>
              </div>
              <div className="card-badge">Match Found!</div>
            </div>
          </div>
        </div>
      </header>

      <section className="vibe-section">
        <div className="container">
          <div className="vibe-grid">
            <motion.div
              className="vibe-text"
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2>The Aesthetic of Connection.</h2>
              <p>
                From late-night study sessions to weekend vibes, CathodeAnode is where the campus heartbeat lives.
                Experience a platform designed for your generation—minimal, high-tech, and high-vibe.
              </p>
              <button className="btn-secondary large" onClick={onJoin}>Explore Culture</button>
            </motion.div>
            <motion.div
              className="vibe-visual"
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
            >
              <div className="feature-img-card">
                <img src="/assets/campus_vibes.png" alt="Campus Vibes" />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="feature-showcase section-padding">
        <div className="container">
          <div className="section-header text-center">
            <h2 className="section-title">Why CathodeAnode?</h2>
            <p className="section-subtitle">"It's the vibe for me" — every student ever.</p>
          </div>
          <div className="features-grid">
            <div className="feature-card glass-card">
              <div className="feature-img-card small">
                <img src="/assets/premium_vib.png" alt="Premium Vibes" />
              </div>
              <h3>Premium Feeling</h3>
              <p>Designed with the same obsession as your favorite tech products. Pure luxury.</p>
            </div>
            <div className="feature-card glass-card">
              <div className="icon-circle"><ShieldCheck /></div>
              <h3>Privacy No Cap</h3>
              <p>Your data stays on campus. Our safety benchmarks are actually industry-leading.</p>
            </div>
            <div className="feature-card glass-card">
              <div className="icon-circle"><MessageCircle /></div>
              <h3>Stage Flow</h3>
              <p>Natural connections. No awkward "so what's your name?" moments.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rules-section section-padding">
        <div className="container rules-container">
          <div className="section-header text-center">
            <h2 className="section-title">Rules of the Anode</h2>
            <p className="section-subtitle">Keep it high-vibe, keep it safe. No cap.</p>
          </div>
          <div className="rules-grid">
            <div className="rule-card">
              <span className="icon-label">🛡️</span>
              <h3>No Fakes Allowed</h3>
              <p>Verified university emails only. If you're not a student, you're not in the circle.</p>
            </div>
            <div className="rule-card">
              <span className="icon-label">✨</span>
              <h3>Main Character Energy</h3>
              <p>Be yourself. Authentic vibes only. Respect the spark or leave it be.</p>
            </div>
            <div className="rule-card">
              <span className="icon-label">🔒</span>
              <h3>Zero Drama</h3>
              <p>Safety benchmarks are industry-leading. Disrespect is an instant ban. Stay classy.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="hype-cta">
        <div className="container">
          <motion.div
            className="hype-card"
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <h2>Ready to find your match?</h2>
            <p>Join 2,000+ students already catching the vibe.</p>
            <button className="btn-primary large" style={{ background: 'white', color: 'var(--accent-pink)' }} onClick={onJoin}>
              Join CathodeAnode Now
            </button>
          </motion.div>
        </div>
      </section>

      <footer className="main-footer">
        <div className="container">
          <div className="footer-top">
            <div className="footer-brand">
              <div className="logo-area">
                <Heart size={24} fill="var(--accent-pink)" />
                <span className="logo-text">CathodeAnode</span>
              </div>
              <p>Happier campus connections starts here.</p>
            </div>
            <div className="footer-social">
              <h4>Follow Us</h4>
              <div className="social-icons">
                <Instagram size={20} />
                <Twitter size={20} />
                <Github size={20} />
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2026 CathodeAnode. Developed for the Culture.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

const AuthView = ({ type, email, setEmail, error, loading, onSubmit, onBack, onSwitch }) => {
  return (
    <motion.div
      className="auth-screen"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
    >
      <button className="back-btn" onClick={onBack}>
        <ArrowRight size={18} style={{ transform: 'rotate(180deg)' }} /> Back
      </button>

      <div className="auth-card glass-card">
        <div className="auth-logo">
          <Heart fill="var(--accent-pink)" size={32} />
          <span className="logo-text">CathodeAnode</span>
        </div>
        <h2 className="auth-title">{type === 'signup' ? 'Create Account' : 'Welcome Back'}</h2>
        <p className="auth-subtitle">
          {type === 'signup'
            ? 'Sign up with your university email to join the circle.'
            : 'Enter your university email to log in securely.'}
        </p>
        <form onSubmit={onSubmit}>
          <div className="input-group">
            <label className="input-label">University Email</label>
            <div className="input-wrapper">
              <Mail className="input-icon" size={18} />
              <input
                type="email"
                className="auth-input"
                placeholder="rollnumber@gbu.ac.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {error && (
              <div className="error-msg">
                <AlertCircle size={14} />
                {error}
              </div>
            )}
          </div>
          <button type="submit" className="btn-primary btn-full large" disabled={loading}>
            {loading ? 'Sending OTP...' : (type === 'signup' ? 'Sign Up' : 'Continue')}
          </button>
        </form>
        <div className="auth-footer">
          {type === 'signup' ? (
            <span>Already have an account? <span className="switch-link" onClick={onSwitch}>Log In</span></span>
          ) : (
            <span>New to campus? <span className="switch-link" onClick={onSwitch}>Join Now</span></span>
          )}
        </div>
      </div>
      <div className="pink-gradient-bg">
        <div className="pink-orb orb-1"></div>
        <div className="pink-orb orb-2"></div>
      </div>
    </motion.div>
  );
};

const OnboardingView = ({ session, onComplete }) => {
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    branch: '',
    school: '',
    department: '',
    whatsapp: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // WhatsApp validation (simple check for 10 digits)
    const cleanWhatsApp = formData.whatsapp.replace(/\D/g, '');
    if (cleanWhatsApp.length !== 10) {
      setError('Please enter a valid 10-digit WhatsApp number.');
      setLoading(false);
      return;
    }

    try {
      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert({
          id: session.user.id,
          name: formData.name,
          age: parseInt(formData.age),
          branch: formData.branch,
          school: formData.school,
          department: formData.department,
          whatsapp: '+91' + cleanWhatsApp,
          updated_at: new Date()
        });

      if (upsertError) throw upsertError;
      onComplete();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      className="auth-screen"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <div className="auth-card glass-card onboarding-card">
        <div className="auth-logo">
          <Sparkles fill="var(--accent-pink)" size={32} color="var(--accent-pink)" />
          <span className="logo-text">Setup Profile</span>
        </div>

        <p className="auth-subtitle">Almost there! Tell us a bit about yourself.</p>

        <form onSubmit={handleSubmit} className="onboarding-form">
          <div className="form-grid">
            <div className="input-group">
              <label className="input-label">Full Name</label>
              <div className="input-wrapper">
                <User className="input-icon" size={18} />
                <input
                  type="text"
                  className="auth-input"
                  placeholder="Your Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Age</label>
              <div className="input-wrapper">
                <Calendar className="input-icon" size={18} />
                <input
                  type="number"
                  className="auth-input"
                  placeholder="eg. 19"
                  value={formData.age}
                  onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">School</label>
              <div className="input-wrapper">
                <School className="input-icon" size={18} />
                <input
                  type="text"
                  className="auth-input"
                  placeholder="e.g. SOE, SOB"
                  value={formData.school}
                  onChange={(e) => setFormData({ ...formData, school: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Department</label>
              <div className="input-wrapper">
                <BookOpen className="input-icon" size={18} />
                <input
                  type="text"
                  className="auth-input"
                  placeholder="e.g. ICT, Management"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="input-group full-width-col">
              <label className="input-label">Branch</label>
              <div className="input-wrapper">
                <Hash className="input-icon" size={18} />
                <input
                  type="text"
                  className="auth-input"
                  placeholder="e.g. B.Tech CS, MBA"
                  value={formData.branch}
                  onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="input-group full-width-col">
              <label className="input-label">WhatsApp Number (+91)</label>
              <div className="input-wrapper">
                <Phone className="input-icon" size={18} />
                <input
                  type="tel"
                  className="auth-input"
                  placeholder="10-digit number"
                  value={formData.whatsapp}
                  onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                  required
                />
              </div>
            </div>
          </div>

          {error && <div className="error-msg"><AlertCircle size={14} /> {error}</div>}

          <button type="submit" className="btn-primary btn-full large" disabled={loading}>
            {loading ? 'Saving Proifle...' : 'Complete Profile'}
          </button>
        </form>
      </div>

      <div className="pink-gradient-bg">
        <div className="pink-orb orb-1"></div>
        <div className="pink-orb orb-3"></div>
      </div>

      <style jsx>{`
        .onboarding-card {
          max-width: 600px;
        }
        .onboarding-form {
          text-align: left;
        }
        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }
        .full-width-col {
          grid-column: span 2;
        }
        @media (max-width: 600px) {
          .form-grid {
            grid-template-columns: 1fr;
          }
          .full-width-col {
            grid-column: span 1;
          }
        }
      `}</style>
    </motion.div>
  );
};

const DashboardView = ({ profile, onGoToProfile, onLogout }) => {
  const [isSearching, setIsSearching] = useState(false);
  const searchInterval = useRef();

  const toggleSearch = async () => {
    const nextState = !isSearching;
    setIsSearching(nextState);

    await supabase.from('profiles').update({ is_searching: nextState }).eq('id', profile.id);

    if (nextState) {
      // Start searching for others
      searchInterval.current = setInterval(async () => {
        const { data: others, error } = await supabase
          .from('profiles')
          .select('id, name')
          .eq('is_searching', true)
          .neq('id', profile.id)
          .limit(1);

        if (others && others.length > 0) {
          const matchedUser = others[0];
          // Create chat session (always lower ID is user1 to avoid double chats)
          const [u1, u2] = profile.id < matchedUser.id ? [profile.id, matchedUser.id] : [matchedUser.id, profile.id];

          const { data: existing } = await supabase
            .from('chats')
            .select('*')
            .match({ user1_id: u1, user2_id: u2, active: true })
            .single();

          if (!existing) {
            await supabase.from('chats').insert({
              user1_id: u1,
              user2_id: u2,
              active: true,
              stage: 0
            });
            // Stop searching
            clearInterval(searchInterval.current);
            await supabase.from('profiles').update({ is_searching: false }).eq('id', profile.id);
          }
        }
      }, 3000);
    } else {
      clearInterval(searchInterval.current);
    }
  };

  useEffect(() => {
    return () => clearInterval(searchInterval.current);
  }, []);

  return (
    <div className="dashboard-container">
      <nav className="dash-nav glass-card">
        <div className="container nav-flex">
          <div className="logo-area">
            <Heart size={24} fill="var(--accent-pink)" />
            <span className="logo-text">CathodeAnode</span>
          </div>
          <div className="user-menu">
            <button className="icon-btn" onClick={onGoToProfile}>
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="profile" className="nav-avatar" />
              ) : <UserCircle size={28} />}
            </button>
            <button className="icon-btn logout" onClick={onLogout}><LogOut size={22} /></button>
          </div>
        </div>
      </nav>

      <main className="container main-dash">
        <motion.div
          className="welcome-card glass-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="profile-summary">
            <div className="sum-avatar">
              {profile.avatar_url ? <img src={profile.avatar_url} alt="avatar" /> : <User size={40} />}
            </div>
            <div className="sum-info">
              <h2>Hey, {profile.name}! ✨</h2>
              <p>{profile.school} • {profile.branch}</p>
            </div>
          </div>
        </motion.div>

        <div className="matching-hub">
          <motion.div
            className="match-radar glass-card"
            animate={{
              backgroundColor: isSearching ? 'rgba(255, 100, 162, 0.05)' : 'rgba(255, 255, 255, 0.8)'
            }}
          >
            <div className="radar-header">
              <Sparkles size={24} color="var(--accent-pink)" />
              <h3>Campus Radar</h3>
            </div>

            <p className="radar-desc">
              {isSearching
                ? "Searching for someone amazing from your uni..."
                : "Ready to meet someone new? Turn on the radar!"}
            </p>

            <div className={`radar-visual ${isSearching ? 'active' : ''}`}>
              <div className="pulse-1"></div>
              <div className="pulse-2"></div>
              <Heart size={48} fill={isSearching ? "var(--accent-pink)" : "transparent"} color="var(--accent-pink)" />
            </div>

            <button
              className={`btn-primary large radar-btn ${isSearching ? 'searching' : ''}`}
              onClick={toggleSearch}
            >
              {isSearching ? <><Search size={20} className="spin" /> Stop Search</> : "Start Matching"}
            </button>
          </motion.div>
        </div>
      </main>

      <div className="pink-gradient-bg">
        <div className="pink-orb orb-1"></div>
        <div className="pink-orb orb-2"></div>
      </div>

      <style jsx>{`
        .dashboard-container { min-height: 100vh; padding-top: 100px; }
        .dash-nav { position: fixed; top: 1rem; left: 50%; transform: translateX(-50%); width: 95%; max-width: 1200px; height: 64px; display: flex; align-items: center; z-index: 100; }
        .user-menu { display: flex; gap: 1rem; align-items: center; }
        .nav-avatar { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 2px solid var(--accent-pink); }
        .icon-btn { background: none; border: none; cursor: pointer; color: var(--text-heading); opacity: 0.8; transition: all 0.3s; padding: 5px; }
        .icon-btn:hover { opacity: 1; color: var(--accent-pink); }
        .logout:hover { color: #E94057; }
        .main-dash { display: grid; gap: 2rem; max-width: 800px; }
        .welcome-card { padding: 1.5rem 2rem; }
        .profile-summary { display: flex; align-items: center; gap: 1.5rem; }
        .sum-avatar { width: 80px; height: 80px; background: var(--accent-soft); border-radius: 50%; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .sum-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .sum-info h2 { font-size: 1.5rem; margin-bottom: 0.2rem; }
        .sum-info p { opacity: 0.7; font-size: 0.9rem; }
        .matching-hub { display: flex; justify-content: center; margin-top: 1rem; }
        .match-radar { width: 100%; padding: 3rem; text-align: center; display: flex; flex-direction: column; align-items: center; }
        .radar-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem; }
        .radar-desc { opacity: 0.7; max-width: 300px; margin-bottom: 2rem; font-size: 0.95rem; }
        .radar-visual { width: 200px; height: 200px; position: relative; display: flex; align-items: center; justify-content: center; margin-bottom: 3rem; }
        .pulse-1, .pulse-2 { position: absolute; width: 100%; height: 100%; border: 2px solid var(--accent-pink); border-radius: 50%; opacity: 0; }
        .radar-visual.active .pulse-1 { animation: pulse 3s infinite; }
        .radar-visual.active .pulse-2 { animation: pulse 3s infinite 1.5s; }
        @keyframes pulse { 0% { transform: scale(0.5); opacity: 0.5; } 100% { transform: scale(1.5); opacity: 0; } }
        .radar-btn.searching { background: var(--text-main); }
        .spin { animation: spin 2s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

const ProfileView = ({ profile, onBack, onUpdate }) => {
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef();

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.id}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', profile.id);

      onUpdate();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-container">
      <button className="back-btn" onClick={onBack}>
        <ArrowRight size={18} style={{ transform: 'rotate(180deg)' }} /> Back
      </button>

      <main className="container main-dash">
        <div className="glass-card profile-edit-card">
          <div className="photo-section">
            <div className="large-avatar">
              {profile.avatar_url ? <img src={profile.avatar_url} alt="profile" /> : <User size={60} />}
              {loading && <div className="upload-overlay">Processing...</div>}
            </div>
            <button className="btn-secondary" onClick={() => fileInputRef.current.click()}>
              <Camera size={18} /> Change Photo
            </button>
            <input
              type="file"
              ref={fileInputRef}
              hidden
              accept="image/*"
              onChange={handlePhotoUpload}
            />
          </div>

          <div className="profile-details-list">
            <div className="detail-item">
              <span className="label">Name</span>
              <span className="val">{profile.name}</span>
            </div>
            <div className="detail-item">
              <span className="label">WhatsApp</span>
              <span className="val">{profile.whatsapp}</span>
            </div>
            <div className="detail-item">
              <span className="label">School</span>
              <span className="val">{profile.school}</span>
            </div>
            <div className="detail-item">
              <span className="label">Dept / Branch</span>
              <span className="val">{profile.department} / {profile.branch}</span>
            </div>
          </div>

          <div className="safety-note">
            <ShieldCheck size={16} />
            Your contact details are only shared with mutual consent at Stage 5.
          </div>
        </div>
      </main>

      <div className="pink-gradient-bg">
        <div className="pink-orb orb-1"></div>
        <div className="pink-orb orb-2"></div>
      </div>

      <style jsx>{`
        .profile-edit-card { padding: 3rem; text-align: center; }
        .photo-section { display: flex; flex-direction: column; align-items: center; gap: 1.5rem; margin-bottom: 3rem; }
        .large-avatar { width: 150px; height: 150px; background: var(--accent-soft); border-radius: 50%; overflow: hidden; display: flex; align-items: center; justify-content: center; border: 4px solid white; box-shadow: var(--glass-shadow); position: relative; }
        .large-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .upload-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.5); color: white; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; }
        .profile-details-list { text-align: left; background: rgba(255,255,255,0.4); border-radius: 16px; padding: 1rem; margin-bottom: 2rem; }
        .detail-item { padding: 1rem; border-bottom: 1px solid rgba(255,100,162,0.1); display: flex; justify-content: space-between; }
        .detail-item:last-child { border-bottom: none; }
        .label { font-weight: 700; opacity: 0.6; font-size: 0.85rem; text-transform: uppercase; }
        .val { font-weight: 600; color: var(--text-heading); }
        .safety-note { display: flex; align-items: center; justify-content: center; gap: 0.5rem; font-size: 0.8rem; opacity: 0.6; }
      `}</style>
    </div>
  );
};

const ChatView = ({ profile, chat, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [otherUserProfile, setOtherUserProfile] = useState(null);
  const messagesEndRef = useRef(null);

  const otherUserId = chat?.user1_id === profile?.id ? chat?.user2_id : chat?.user1_id;

  useEffect(() => {
    if (!chat || !profile) return;

    const fetchOtherProfile = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', otherUserId)
        .single();
      if (data) setOtherUserProfile(data);
      if (error) console.error("Error fetching other user profile:", error);
    };

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chat.id)
        .order('created_at', { ascending: true });
      if (data) setMessages(data);
      if (error) console.error("Error fetching messages:", error);
    };

    fetchOtherProfile();
    fetchMessages();

    const messageSubscription = supabase
      .channel(`chat_${chat.id}_messages`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chat.id}` }, payload => {
        setMessages((prevMessages) => [...prevMessages, payload.new]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(messageSubscription);
    };
  }, [chat, profile, otherUserId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !chat || !profile) return;

    const { error } = await supabase.from('messages').insert({
      chat_id: chat.id,
      sender_id: profile.id,
      content: newMessage,
    });

    if (error) console.error("Error sending message:", error);
    setNewMessage('');
  };

  const handleStageAction = async (actionType) => {
    if (!chat || !profile) return;

    let newStage = chat.stage;
    let newActiveStatus = true;

    if (actionType === 'advance') {
      newStage = chat.stage + 1;
    } else if (actionType === 'decline') {
      newActiveStatus = false; // End chat
    }

    const { error } = await supabase
      .from('chats')
      .update({ stage: newStage, active: newActiveStatus })
      .eq('id', chat.id);

    if (error) console.error("Error updating chat stage:", error);
  };

  const renderStageContent = () => {
    if (!chat || !otherUserProfile) return null;

    const isMyTurnToAdvance = (chat.stage % 2 === 0 && chat.user1_id === profile.id) || (chat.stage % 2 !== 0 && chat.user2_id === profile.id);
    const isOtherTurnToAdvance = (chat.stage % 2 === 0 && chat.user2_id === profile.id) || (chat.stage % 2 !== 0 && chat.user1_id === profile.id);

    switch (chat.stage) {
      case 0: // Initial connection
        return (
          <div className="chat-stage-info">
            <MessageCircle size={48} color="var(--accent-pink)" />
            <h3>You've connected with {otherUserProfile.name}!</h3>
            <p>Say hi and see if there's a spark. Your messages are ephemeral.</p>
            {isMyTurnToAdvance ? (
              <button className="btn-primary large" onClick={() => handleStageAction('advance')}>
                Say Hi! <ArrowRight size={20} />
              </button>
            ) : (
              <p className="waiting-text">Waiting for {otherUserProfile.name} to initiate the chat...</p>
            )}
            <button className="btn-secondary" onClick={() => handleStageAction('decline')}>
              <X size={16} /> End Chat
            </button>
          </div>
        );
      case 1: // Chatting stage
        return (
          <div className="chat-stage-info">
            <Heart size={48} color="var(--accent-pink)" />
            <h3>Stage 1: Get to know each other!</h3>
            <p>Chat freely. If you feel a connection, you can reveal your interests.</p>
            {isMyTurnToAdvance ? (
              <button className="btn-primary large" onClick={() => handleStageAction('advance')}>
                Reveal Interests <ArrowRight size={20} />
              </button>
            ) : (
              <p className="waiting-text">Waiting for {otherUserProfile.name} to reveal interests...</p>
            )}
            <button className="btn-secondary" onClick={() => handleStageAction('decline')}>
              <X size={16} /> End Chat
            </button>
          </div>
        );
      case 2: // Interests revealed
        return (
          <div className="chat-stage-info">
            <Sparkles size={48} color="var(--accent-pink)" />
            <h3>Stage 2: Interests Revealed!</h3>
            <p>You both have shown interest! Now you can choose to reveal your contact details.</p>
            {isMyTurnToAdvance ? (
              <button className="btn-primary large" onClick={() => handleStageAction('advance')}>
                Reveal Contact <ArrowRight size={20} />
              </button>
            ) : (
              <p className="waiting-text">Waiting for {otherUserProfile.name} to reveal contact...</p>
            )}
            <button className="btn-secondary" onClick={() => handleStageAction('decline')}>
              <X size={16} /> End Chat
            </button>
          </div>
        );
      case 3: // Contact revealed
        return (
          <div className="chat-stage-info">
            <Phone size={48} color="var(--accent-pink)" />
            <h3>Stage 3: Contact Revealed!</h3>
            <p>You both have revealed your WhatsApp numbers. Connect outside CathodeAnode!</p>
            <p className="contact-info">
              <Phone size={18} /> {otherUserProfile.whatsapp}
            </p>
            <a href={`https://wa.me/${otherUserProfile.whatsapp.replace('+', '')}`} target="_blank" rel="noopener noreferrer" className="btn-primary large">
              Connect on WhatsApp <ArrowRight size={20} />
            </a>
            <button className="btn-secondary" onClick={() => handleStageAction('decline')}>
              <X size={16} /> End Chat
            </button>
          </div>
        );
      default:
        return (
          <div className="chat-stage-info">
            <AlertCircle size={48} color="var(--accent-pink)" />
            <h3>Chat Ended</h3>
            <p>This conversation has concluded.</p>
            <button className="btn-primary large" onClick={onClose}>
              Back to Dashboard
            </button>
          </div>
        );
    }
  };

  return (
    <motion.div
      className="chat-screen"
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -100 }}
    >
      <div className="chat-header glass-card">
        <button className="back-btn" onClick={onClose}>
          <ArrowRight size={18} style={{ transform: 'rotate(180deg)' }} />
        </button>
        <div className="chat-partner-info">
          {otherUserProfile?.avatar_url ? (
            <img src={otherUserProfile.avatar_url} alt="partner" className="chat-avatar" />
          ) : (
            <UserCircle size={36} />
          )}
          <h3>{otherUserProfile?.name || 'Loading...'}</h3>
          <span className="chat-stage-badge">Stage {chat?.stage || 0}</span>
        </div>
        <button className="icon-btn" onClick={() => handleStageAction('decline')}>
          <X size={22} />
        </button>
      </div>

      <div className="chat-messages-container">
        <div className="chat-messages">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`message ${msg.sender_id === profile.id ? 'my-message' : 'other-message'}`}
            >
              <p>{msg.content}</p>
              <span className="message-time">
                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="chat-input-area glass-card">
        {chat?.stage < 3 ? ( // Allow messaging up to stage 2
          <form onSubmit={handleSendMessage} className="message-form">
            <input
              type="text"
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="chat-input"
              disabled={chat?.stage >= 3}
            />
            <button type="submit" className="btn-primary" disabled={chat?.stage >= 3}>
              <ArrowRight size={20} />
            </button>
          </form>
        ) : (
          <div className="chat-input-disabled">
            <p>Messaging is disabled at this stage. Please use WhatsApp.</p>
          </div>
        )}
        <div className="chat-stage-actions">
          {renderStageContent()}
        </div>
      </div>

      <div className="pink-gradient-bg">
        <div className="pink-orb orb-1"></div>
        <div className="pink-orb orb-2"></div>
      </div>

      <style jsx>{`
        .chat-screen {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          background: var(--bg-color);
          z-index: 1000;
          padding-top: 80px; /* For header */
          padding-bottom: 200px; /* For input and stage actions */
        }
        .chat-header {
          position: fixed;
          top: 1rem;
          left: 50%;
          transform: translateX(-50%);
          width: 95%;
          max-width: 700px;
          height: 64px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 1.5rem;
          z-index: 101;
        }
        .chat-partner-info {
          display: flex;
          align-items: center;
          gap: 0.8rem;
        }
        .chat-partner-info h3 {
          margin: 0;
          font-size: 1.1rem;
        }
        .chat-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid var(--accent-pink);
        }
        .chat-stage-badge {
          background: var(--accent-soft);
          color: var(--accent-pink);
          padding: 0.2rem 0.6rem;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 600;
        }
        .chat-messages-container {
          flex-grow: 1;
          overflow-y: auto;
          padding: 1rem;
          max-width: 700px;
          width: 100%;
          margin: 0 auto;
        }
        .chat-messages {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .message {
          max-width: 70%;
          padding: 0.7rem 1rem;
          border-radius: 18px;
          position: relative;
          font-size: 0.9rem;
          line-height: 1.4;
        }
        .my-message {
          align-self: flex-end;
          background: var(--accent-pink);
          color: white;
          border-bottom-right-radius: 4px;
        }
        .other-message {
          align-self: flex-start;
          background: rgba(255, 255, 255, 0.8);
          color: var(--text-main);
          border-bottom-left-radius: 4px;
        }
        .message-time {
          font-size: 0.65rem;
          opacity: 0.7;
          position: absolute;
          bottom: 4px;
          right: 10px;
          color: inherit;
        }
        .my-message .message-time {
          color: rgba(255, 255, 255, 0.8);
        }
        .other-message .message-time {
          color: var(--text-main);
        }
        .chat-input-area {
          position: fixed;
          bottom: 1rem;
          left: 50%;
          transform: translateX(-50%);
          width: 95%;
          max-width: 700px;
          padding: 1rem 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          z-index: 101;
        }
        .message-form {
          display: flex;
          gap: 0.5rem;
        }
        .chat-input {
          flex-grow: 1;
          padding: 0.8rem 1rem;
          border: 1px solid rgba(255, 100, 162, 0.2);
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.6);
          color: var(--text-main);
          font-size: 1rem;
          outline: none;
          transition: all 0.3s ease;
        }
        .chat-input:focus {
          border-color: var(--accent-pink);
          background: white;
        }
        .chat-input::placeholder {
          color: var(--text-light);
        }
        .chat-input:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .chat-input-disabled {
          text-align: center;
          padding: 0.5rem;
          color: var(--text-light);
          font-size: 0.9rem;
        }
        .chat-stage-actions {
          text-align: center;
          padding-top: 1rem;
          border-top: 1px solid rgba(255, 100, 162, 0.1);
        }
        .chat-stage-info {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.8rem;
        }
        .chat-stage-info h3 {
          margin: 0;
          font-size: 1.2rem;
          color: var(--text-heading);
        }
        .chat-stage-info p {
          margin: 0;
          font-size: 0.9rem;
          opacity: 0.7;
          max-width: 80%;
        }
        .chat-stage-info .btn-primary, .chat-stage-info .btn-secondary {
          width: 100%;
          max-width: 250px;
          margin-top: 0.5rem;
        }
        .waiting-text {
          font-style: italic;
          color: var(--text-light);
        }
        .contact-info {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 600;
          color: var(--text-heading);
          font-size: 1.1rem;
        }
      `}</style>
    </motion.div>
  );
};

const AuthSentView = ({ email, onBack }) => {
  return (
    <motion.div
      className="auth-screen"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
    >
      <div className="auth-card glass-card">
        <div className="auth-logo">
          <Mail fill="var(--accent-pink)" size={48} color="white" />
        </div>
        <h2 className="auth-title">Check your Inbox</h2>
        <p className="auth-subtitle">
          We've sent a magic link to <br />
          <strong>{email}</strong>. <br /><br />
          Click the link in the email to sign in instantly.
        </p>
        <button className="btn-secondary btn-full" onClick={onBack}>
          Try another email
        </button>
      </div>
      <div className="pink-gradient-bg">
        <div className="pink-orb orb-1"></div>
        <div className="pink-orb orb-2"></div>
      </div>
    </motion.div>
  );
};

export default App;

const AboutView = ({ onBack }) => {
  return (
    <motion.div
      className="about-container"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <nav className="navbar glass-card splash-nav">
        <div className="container nav-flex">
          <div className="logo-area" onClick={onBack} style={{ cursor: 'pointer' }}>
            <Heart size={24} fill="var(--accent-pink)" />
            <span className="logo-text">CathodeAnode</span>
          </div>
          <button className="btn-secondary" onClick={onBack}>Back to Home</button>
        </div>
      </nav>

      <main className="container about-content">
        <section className="about-hero text-center">
          <h1 className="gradient-text">Beyond Just Chatting.</h1>
          <p>We're building the infrastructure for authentic campus connections.</p>
        </section>

        <section className="about-sections">
          <div className="glass-card mission-card">
            <h2>The Mission 🚀</h2>
            <p>
              In a world of dry texts and superficial scrolls, CathodeAnode was born to bring back the "Main Character Energy"
              to campus social life. We believe your university years should be filled with spontaneous conversations,
              genuine matches, and absolute digital safety.
            </p>
          </div>

          <div className="values-grid">
            <div className="value-item glass-card">
              <div className="icon-circle"><ShieldCheck size={32} /></div>
              <h3>Privacy First</h3>
              <p>Your data never leaves your campus domain. No shadow profiles, no tracking.</p>
            </div>
            <div className="value-item glass-card">
              <div className="icon-circle"><Zap size={32} /></div>
              <h3>Real-Time Vibes</h3>
              <p>No waiting for days. Match instantly, chat instantly, feel the vibe instantly.</p>
            </div>
            <div className="value-item glass-card">
              <div className="icon-circle"><Heart size={32} /></div>
              <h3>Consent Logic</h3>
              <p>Our 5-stage reveal ensures you're always in control of who knows your name.</p>
            </div>
          </div>
        </section>

        <section className="about-cta text-center">
          <h2>Ready to Catch the Anode?</h2>
          <button className="btn-primary large" onClick={onBack}>Join the Circle Now</button>
        </section>
      </main>

      <footer className="main-footer">
        <div className="container">
          <div className="footer-bottom">
            <p>&copy; 2026 CathodeAnode. Developed for the Culture.</p>
          </div>
        </div>
      </footer>

      <div className="pink-gradient-bg">
        <div className="pink-orb orb-1"></div>
        <div className="pink-orb orb-2"></div>
      </div>
    </motion.div>
  );
};
