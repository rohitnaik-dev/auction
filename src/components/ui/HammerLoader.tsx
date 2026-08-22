'use client'

import React from 'react'
import clsx from 'clsx'

interface HammerLoaderProps {
  size?: 'sm' | 'md' | 'lg' | 'fullscreen'
  text?: string
  subtext?: string
  className?: string
}

export default function HammerLoader({
  size = 'md',
  text = 'Live Auction',
  subtext = 'Connecting to real-time room...',
  className = '',
}: HammerLoaderProps) {
  const isFullscreen = size === 'fullscreen'
  const isLg = size === 'lg' || isFullscreen
  const isSm = size === 'sm'

  const container = (
    <div className={clsx("flex flex-col items-center justify-center select-none", className)}>
      <div className={clsx("relative flex items-center justify-center", isSm ? "w-16 h-16" : isLg ? "w-28 h-28" : "w-20 h-20")}>
        
        {/* Animated Hammer SVG */}
        <svg
          viewBox="0 0 100 100"
          className={clsx("w-full h-full drop-shadow-md")}
          style={{ overflow: 'visible' }}
        >
          {/* Sound Block at the bottom */}
          <g id="soundblock">
            {/* Wooden Base */}
            <rect
              x="20"
              y="74"
              width="60"
              height="12"
              rx="4"
              fill="#4338CA"
              stroke="#312E81"
              strokeWidth="2"
            />
            {/* Top Plate */}
            <rect
              x="25"
              y="70"
              width="50"
              height="5"
              rx="2.5"
              fill="#F59E0B"
              stroke="#D97706"
              strokeWidth="1"
            />
          </g>

          {/* Impact Shockwave Ring */}
          <circle
            cx="48"
            cy="72"
            r="8"
            fill="none"
            stroke="#F59E0B"
            strokeWidth="3"
            opacity="0"
            className="animate-impact-wave"
          />

          {/* Gavel Hammer - Pivot at right handle tip */}
          <g
            id="gavel-hammer"
            className="animate-gavel-strike origin-[75px_70px]"
          >
            {/* Handle */}
            <path
              d="M75 70 L48 45"
              stroke="#818CF8"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <path
              d="M75 70 L65 60"
              stroke="#312E81"
              strokeWidth="6"
              strokeLinecap="round"
            />

            {/* Gavel Head */}
            <g transform="translate(42, 38) rotate(42)">
              {/* Main Barrel */}
              <rect
                x="-14"
                y="-7"
                width="28"
                height="14"
                rx="3"
                fill="#312E81"
                stroke="#1E1B4B"
                strokeWidth="1.5"
              />
              {/* Brass Center Ring */}
              <rect
                x="-4"
                y="-7.5"
                width="8"
                height="15"
                rx="1"
                fill="#FBBF24"
                stroke="#D97706"
                strokeWidth="1"
              />
              {/* Left & Right Striking Caps */}
              <rect
                x="-16"
                y="-6"
                width="3"
                height="12"
                rx="1"
                fill="#F59E0B"
              />
              <rect
                x="13"
                y="-6"
                width="3"
                height="12"
                rx="1"
                fill="#F59E0B"
              />
            </g>
          </g>
        </svg>
      </div>

      {text && (
        <div className="text-center mt-4">
          <p className={clsx("font-bold text-gray-900 tracking-tight", isSm ? "text-xs" : isLg ? "text-lg" : "text-sm")}>
            {text}
          </p>
          {subtext && !isSm && (
            <p className="text-xs text-gray-500 mt-1 animate-pulse">
              {subtext}
            </p>
          )}
        </div>
      )}

      {/* Embedded CSS Animations */}
      <style jsx global>{`
        @keyframes gavel-strike {
          0% {
            transform: rotate(0deg);
          }
          30% {
            transform: rotate(-38deg);
          }
          65% {
            transform: rotate(18deg);
          }
          75% {
            transform: rotate(24deg);
          }
          85% {
            transform: rotate(15deg);
          }
          100% {
            transform: rotate(0deg);
          }
        }

        @keyframes impact-wave {
          0%, 60% {
            r: 4;
            opacity: 0;
            stroke-width: 3;
          }
          68% {
            opacity: 1;
            stroke-width: 3;
          }
          100% {
            r: 22;
            opacity: 0;
            stroke-width: 0.5;
          }
        }

        .animate-gavel-strike {
          animation: gavel-strike 1.1s cubic-bezier(0.25, 1, 0.5, 1) infinite;
          transform-origin: 70px 65px;
        }

        .animate-impact-wave {
          animation: impact-wave 1.1s ease-out infinite;
        }
      `}</style>
    </div>
  )

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#F8F7F4]/90 backdrop-blur-xs">
        <div className="p-8 bg-white/95 rounded-3xl shadow-xl border border-gray-100 max-w-xs w-full flex items-center justify-center">
          {container}
        </div>
      </div>
    )
  }

  return container
}
