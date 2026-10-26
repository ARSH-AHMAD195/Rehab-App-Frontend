import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowRight, ChevronDown, Dumbbell, Heart, Lock, Shield, Sparkles, Stethoscope } from 'lucide-react';
import { InstallButton } from '../components/pwa/PwaPrompts';

export const LandingPage = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    {
      q: 'What is surgical prehabilitation?',
      a: 'Prehabilitation is a proactive clinical protocol that prepares your physical endurance, cardiovascular capacity, respiratory reserve, and nutritional status before undergoing major surgery to support smoother post-operative recovery.',
    },
    {
      q: 'How does remote doctor supervision work?',
      a: 'Your hospital surgical team or prehabilitation specialist customizes an exercise regimen tailored to your upcoming surgery. As you complete exercises and log daily vitals, your doctor reviews your adherence and vital sign trends remotely, and is alerted when a reading crosses a safe limit.',
    },
    {
      q: 'Can anyone register for an account?',
      a: 'To maintain clinical safety and medical compliance, patient and doctor accounts are created and verified through authorized clinical onboarding or your hospital prehabilitation team.',
    },
    {
      q: 'How is my private health data protected?',
      // Keep claims verifiable: legal/clinical review before changing this copy
      a: 'Your data travels over encrypted connections. Role-based access controls mean only you and your assigned clinical team can see your records, and record views and clinical changes are written to an audit log.',
    },
    {
      q: 'Does this platform replace my doctor?',
      a: 'No. Fit for Surgery is a clinical monitoring and exercise guidance tool designed to assist your healthcare team. It does not replace medical advice, surgical diagnosis, or emergency healthcare services.',
    },
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-teal-500 selection:text-white">
      {/* Top Banner */}
      <div className="bg-teal-900 text-teal-100 text-xs py-2 px-4 text-center font-medium">
        <span className="inline-flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-teal-300" />
          Clinical Prehabilitation Platform • Clinician Supervised Program
        </span>
      </div>

      {/* Main Navbar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-700 to-teal-500 flex items-center justify-center text-white shadow-md shadow-teal-500/20">
              <Heart className="w-5 h-5 fill-white/20" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-slate-900">
                Fit for Surgery
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                Digital Prehab
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <InstallButton className="hidden sm:inline-flex" />
            <Link
              to="/login"
              className="hidden sm:inline-block text-sm font-semibold text-slate-700 hover:text-teal-700 px-3 py-2 transition-colors"
            >
              Sign In
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold shadow-sm transition-all shadow-teal-600/20"
            >
              <span>Access Portal</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-12 pb-20 lg:pt-20 lg:pb-28 overflow-hidden bg-gradient-to-b from-teal-50/50 via-white to-slate-50/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-100/80 border border-teal-200/80 text-teal-800 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                Evidence-Based Surgical Preparation
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 tracking-tight leading-[1.12]">
                Optimize Your Body <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-700 via-teal-600 to-teal-800">
                  Before You Step Into Surgery.
                </span>
              </h1>
              <p className="text-base sm:text-lg text-slate-600 max-w-2xl leading-relaxed">
                Connect directly with your surgical team. Follow customized physical and respiratory exercises, log daily health vitals, and strengthen cardiopulmonary stamina to prepare for major surgery.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 pt-2">
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-semibold text-base shadow-lg shadow-teal-600/25 transition-all"
                >
                  <span>Launch Portal Dashboard</span>
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <a
                  href="#how-it-works"
                  className="inline-flex items-center justify-center px-6 py-3.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-base transition-colors"
                >
                  How Prehab Works
                </a>
              </div>

              {/* Stats Bar */}
              <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-200/80">
                <div>
                  <p className="text-xl font-bold text-slate-900">Prescribed</p>
                  <p className="text-sm text-slate-600">by your surgical team</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-900">Daily</p>
                  <p className="text-sm text-slate-600">vitals & exercise tracking</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-900">Installable</p>
                  <p className="text-sm text-slate-600">on phone or desktop</p>
                </div>
              </div>
            </div>

            {/* Interactive Preview Card */}
            <div className="lg:col-span-5">
              <div className="bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 relative">
                <div className="absolute -top-3 -right-3 px-3 py-1 bg-teal-700 text-white text-xs font-bold rounded-full shadow-md">
                  Active Clinical Routine
                </div>

                <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                  <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
                    <Activity className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">John Davis</h3>
                    <p className="text-xs text-slate-500">Coronary Artery Bypass Graft (CABG)</p>
                  </div>
                  <div className="ml-auto text-right">
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      18 Days to Surgery
                    </span>
                  </div>
                </div>

                <div className="space-y-3 py-4">
                  <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between text-xs">
                    <span className="text-slate-600">Assigned Surgeon:</span>
                    <span className="font-semibold text-slate-900">Dr. Sarah Jenkins</span>
                  </div>

                  <div className="p-3 bg-teal-50/60 rounded-xl border border-teal-100 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-teal-950">Diaphragmatic Deep Breathing</p>
                      <p className="text-xs text-teal-700">Twice Daily • 10 minutes</p>
                    </div>
                    <span className="text-xs bg-teal-700 text-white px-2 py-1 rounded-lg font-semibold">
                      Completed Today
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-900">Brisk Aerobic Walking</p>
                      <p className="text-xs text-slate-500">20 minutes • Graded intensity</p>
                    </div>
                    <span className="text-xs text-slate-600 bg-slate-200/80 px-2 py-1 rounded-lg font-medium">
                      Scheduled
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <div className="p-2.5 bg-slate-50 rounded-lg text-center">
                      <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Blood Pressure</p>
                      <p className="text-sm font-bold text-slate-900">124 / 78 mmHg</p>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-lg text-center">
                      <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Resting SpO2</p>
                      <p className="text-sm font-bold text-teal-700">98% Room Air</p>
                    </div>
                  </div>
                </div>

                <div className="pt-2 text-center">
                  <Link
                    to="/login"
                    className="text-xs font-semibold text-teal-700 hover:text-teal-900 inline-flex items-center gap-1"
                  >
                    <span>View demo clinical portal</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pillars Section */}
      <section className="py-16 bg-white border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-xs font-bold uppercase tracking-widest text-teal-700">Core Pillars</h2>
            <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
              Multimodal Prehabilitation Framework
            </p>
            <p className="text-sm text-slate-500 mt-2">
              Preparing for major surgery is like training for an endurance athletic event.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 hover:border-teal-200 transition-all">
              <div className="w-12 h-12 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center mb-4">
                <Dumbbell className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-slate-900">Physical Conditioning</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Strengthens large functional muscle groups to support post-operative mobility and independent bed transfers.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 hover:border-teal-200 transition-all">
              <div className="w-12 h-12 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center mb-4">
                <Activity className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-slate-900">Pulmonary Stamina</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Diaphragmatic training and lung expansion exercises prevent post-surgical atelectasis and pneumonia.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 hover:border-teal-200 transition-all">
              <div className="w-12 h-12 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center mb-4">
                <Heart className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-slate-900">Vital Signs Tracking</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Daily logging of blood pressure, heart rate, oxygen saturation, pain, and sleep ensures early detection.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 hover:border-teal-200 transition-all">
              <div className="w-12 h-12 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center mb-4">
                <Stethoscope className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-slate-900">Clinician Oversight</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Your assigned doctor reviews compliance trends, adjusts your exercise plan, and is alerted to out-of-range readings.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-teal-700">Process</span>
            <h2 className="text-3xl font-extrabold text-slate-900 mt-1">
              How Fit for Surgery Works
            </h2>
            <p className="text-sm text-slate-600 mt-2">
              From hospital onboarding to your surgery date, every step is coordinated.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            <div className="relative bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
              <div className="w-8 h-8 rounded-full bg-teal-700 text-white font-bold text-sm flex items-center justify-center mb-4">
                1
              </div>
              <h3 className="font-bold text-slate-900 text-base">Clinical Onboarding</h3>
              <p className="text-xs text-slate-600 mt-2">
                Your doctor inputs your scheduled surgery date, surgical procedure, and target prehab goals.
              </p>
            </div>

            <div className="relative bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
              <div className="w-8 h-8 rounded-full bg-teal-700 text-white font-bold text-sm flex items-center justify-center mb-4">
                2
              </div>
              <h3 className="font-bold text-slate-900 text-base">Custom Routine</h3>
              <p className="text-xs text-slate-600 mt-2">
                Your clinician prescribes exercises from the approved medical library with tailored sets and safety instructions.
              </p>
            </div>

            <div className="relative bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
              <div className="w-8 h-8 rounded-full bg-teal-700 text-white font-bold text-sm flex items-center justify-center mb-4">
                3
              </div>
              <h3 className="font-bold text-slate-900 text-base">Daily Patient Logs</h3>
              <p className="text-xs text-slate-600 mt-2">
                Follow video instructions, mark sessions complete, and enter daily blood pressure, pulse, and SpO2.
              </p>
            </div>

            <div className="relative bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
              <div className="w-8 h-8 rounded-full bg-teal-700 text-white font-bold text-sm flex items-center justify-center mb-4">
                4
              </div>
              <h3 className="font-bold text-slate-900 text-base">Remote Monitoring</h3>
              <p className="text-xs text-slate-600 mt-2">
                Clinicians monitor adherence, address alerts for abnormal values, and generate pre-op clearance reports.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Security & Privacy Section */}
      <section className="py-16 bg-white border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-slate-900 via-navy-900 to-teal-950 text-white rounded-3xl p-8 sm:p-12 shadow-xl">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-teal-300 text-xs font-semibold mb-4">
                <Lock className="w-3.5 h-3.5" />
                Healthcare Privacy & Security
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Designed for Medical Confidentiality
              </h2>
              <p className="text-slate-300 text-sm mt-3 leading-relaxed">
                We prioritize data isolation and administrative accountability. Patients can only see their own clinical records, doctors access only their assigned patients, and sensitive access events are recorded in an audit log.
              </p>

              <div className="grid sm:grid-cols-3 gap-6 mt-8 pt-8 border-t border-white/10 text-xs">
                <div>
                  <h4 className="font-bold text-teal-300">Role-Based Access</h4>
                  <p className="text-slate-400 mt-1">Every request is checked against your role and care team.</p>
                </div>
                <div>
                  <h4 className="font-bold text-teal-300">Audit Trails</h4>
                  <p className="text-slate-400 mt-1">Record views, exports and clinical changes are logged.</p>
                </div>
                <div>
                  <h4 className="font-bold text-teal-300">Clinician Supervised</h4>
                  <p className="text-slate-400 mt-1">No automated medical risk or diagnostic claims.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-xs font-bold uppercase tracking-widest text-teal-700">FAQ</h2>
            <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
              Frequently Asked Questions
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden transition-all shadow-xs"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  aria-expanded={openFaq === i}
                  aria-controls={`faq-answer-${i}`}
                  className="w-full text-left p-5 flex items-center justify-between font-semibold text-slate-800 text-sm hover:text-teal-700"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    aria-hidden="true"
                    className={`w-4 h-4 text-slate-400 transition-transform ${
                      openFaq === i ? 'rotate-180 text-teal-600' : ''
                    }`}
                  />
                </button>
                {openFaq === i && (
                  <div id={`faq-answer-${i}`} className="px-5 pb-5 text-xs text-slate-600 leading-relaxed border-t border-slate-50 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-teal-700 flex items-center justify-center text-white">
                <Heart className="w-4 h-4" />
              </div>
              <span className="font-bold text-white text-base">Fit for Surgery</span>
            </div>
            <div className="flex items-center gap-6">
              <Link to="/login" className="hover:text-white transition-colors">Portal Login</Link>
              <a href="#how-it-works" className="hover:text-white transition-colors">Program Overview</a>
              <span className="text-slate-600">|</span>
              <span className="text-slate-400">Clinical Support: support@fitforsurgery.org</span>
            </div>
          </div>
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p>© {new Date().getFullYear()} Fit for Surgery. Digital Prehabilitation Platform. All rights reserved.</p>
            <p className="text-xs text-slate-300 max-w-md text-center sm:text-right">
              Disclaimer: Fit for Surgery is intended for pre-operative clinical monitoring under the direct supervision of qualified medical personnel.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};
