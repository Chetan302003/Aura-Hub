/**
 * Page Transition Component
 * 
 * Smooth, GPU-accelerated transitions using CSS transforms
 * No heavy JS animations - uses will-change for optimization
 * ~60fps with minimal CPU overhead
 */
import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

export function PageTransition({ children, className }: PageTransitionProps) {
  const location = useLocation();
  const [isVisible, setIsVisible] = useState(true); // Default to true
  const [displayChildren, setDisplayChildren] = useState(children);

  // Update display children immediately if we are visible, so dynamic state updates cleanly
  useEffect(() => {
    if (isVisible) {
      setDisplayChildren(children);
    }
  }, [children, isVisible]);

  useEffect(() => {
    // Start exit animation on route change
    setIsVisible(false);

    // After exit, swap content and enter
    const timeout = setTimeout(() => {
      setDisplayChildren(children);
      setIsVisible(true);
    }, 150);

    return () => clearTimeout(timeout);
  }, [location.pathname]); // ONLY trigger on route change!

  return (
    <div
      className={cn(
        "transition-all duration-200 ease-out",
        isVisible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-2",
        className
      )}
      style={{ willChange: 'opacity, transform' }}
    >
      {displayChildren}
    </div>
  );
}

// Click ripple effect - GPU accelerated
export function ClickTransition({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const [isPressed, setIsPressed] = useState(false);

  const handleClick = () => {
    setIsPressed(true);
    setTimeout(() => setIsPressed(false), 150);
    onClick?.();
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        "cursor-pointer transition-transform duration-150 ease-out active:scale-[0.98]",
        isPressed && "scale-[0.98]",
        className
      )}
      style={{ willChange: 'transform' }}
    >
      {children}
    </div>
  );
}

// Stagger children animation
export function StaggerChildren({
  children,
  className,
  staggerMs = 50,
}: {
  children: React.ReactNode;
  className?: string;
  staggerMs?: number;
}) {
  return (
    <div className={className}>
      {React.Children.map(children, (child, index) => (
        <div
          className="animate-fade-in"
          style={{
            animationDelay: `${index * staggerMs}ms`,
            animationFillMode: 'backwards',
          }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}
