import React from 'react';
import { motion } from 'motion/react';

interface ScreenTransitionProps {
  screenKey: string;
  children: React.ReactNode;
  className?: string;
}

export const ScreenTransition: React.FC<ScreenTransitionProps> = ({
  screenKey,
  children,
  className = '',
}) => {
  return (
    <motion.div
      key={screenKey}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
};
