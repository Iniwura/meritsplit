import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { GenLayerSpinner } from './GenLayerSpinner';
import { Wallet, LogOut, ShieldCheck, FolderGit2, Plus } from 'lucide-react';

interface HeaderProps {
  account: string | null;
  isConnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  account,
  isConnecting,
  onConnect,
  onDisconnect,
}) => {
  const location = useLocation();
  const truncated = account
    ? `${account.slice(0, 6)}...${account.slice(-4)}`
    : null;

  const isProjectsActive = location.pathname.startsWith('/app');
  const isDeployActive = location.pathname.startsWith('/deploy');

  return (
    <header className="border-b border-[#1c1c1c] bg-[#070809]/95 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Left: Brand Wordmark & Global Nav Links */}
        <div className="flex items-center space-x-8">
          <Link
            to="/"
            className="flex items-center space-x-3 group transition-opacity hover:opacity-80"
          >
            <span className="font-display font-extrabold text-xl tracking-tight uppercase text-[#f4f4e8]">
              MeritSplit
            </span>
            <span className="text-[10px] font-mono tracking-widest text-[#686868] uppercase border-l border-[#1c1c1c] pl-3">
              GenLayer
            </span>
          </Link>

          {/* Global Persistent Navigation Links */}
          <nav className="flex items-center space-x-1 sm:space-x-2 font-mono text-xs uppercase tracking-wider">
            <Link
              to="/app"
              className={`px-3.5 py-1.5 transition-all duration-200 flex items-center space-x-1.5 border rounded-none ${
                isProjectsActive
                  ? 'border-[#ccff00] text-[#ccff00] bg-[#ccff00]/10 font-bold'
                  : 'border-transparent text-[#888] hover:text-[#f4f4e8] hover:bg-white/5 hover:border-[#1c1c1c]'
              }`}
            >
              <FolderGit2 className="w-3.5 h-3.5" />
              <span>Projects</span>
            </Link>

            <Link
              to="/deploy"
              className={`px-3.5 py-1.5 transition-all duration-200 flex items-center space-x-1.5 border rounded-none ${
                isDeployActive
                  ? 'border-[#ccff00] text-[#ccff00] bg-[#ccff00]/10 font-bold'
                  : 'border-transparent text-[#888] hover:text-[#f4f4e8] hover:bg-white/5 hover:border-[#1c1c1c]'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Split</span>
            </Link>
          </nav>
        </div>

        {/* Minimalist Wallet Connect Button (Far Right) */}
        <div className="flex items-center space-x-3 text-xs font-mono">
          {account ? (
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-2 border border-[#1c1c1c] bg-[#090a0c] px-3 py-1.5 text-xs text-[#bcbcbc] rounded-none">
                <ShieldCheck className="w-3.5 h-3.5 text-[#ccff00]" />
                <span className="text-[#f4f4e8] font-mono text-xs tracking-tight text-[#bcbcbc] font-bold">
                  {truncated}
                </span>
              </div>
              <button
                onClick={onDisconnect}
                title="Disconnect Wallet"
                className="border border-[#1c1c1c] hover:border-rose-500/50 hover:bg-rose-500/10 hover:text-rose-400 p-2 text-[#888] transition-all duration-200 cursor-pointer rounded-none"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={onConnect}
              disabled={isConnecting}
              className="flex items-center space-x-2 bg-[#ccff00] hover:bg-white text-[#070809] px-4 py-2 font-mono text-xs uppercase font-bold tracking-widest transition-all duration-200 cursor-pointer disabled:opacity-50 rounded-none shadow-[0_0_15px_rgba(204,255,0,0.15)] hover:shadow-[0_0_20px_rgba(255,255,255,0.25)]"
            >
              {isConnecting ? (
                <>
                  <GenLayerSpinner size="sm" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <Wallet className="w-3.5 h-3.5" />
                  <span>Connect Wallet</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
