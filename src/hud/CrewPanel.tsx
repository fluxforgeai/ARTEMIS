import { memo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CREW } from '../data/mission-config';

interface CrewPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default memo(function CrewPanel({ isOpen, onClose }: CrewPanelProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Click-outside overlay */}
          <div className="fixed inset-0 z-30" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full mt-2 left-0 z-40 bg-[rgba(10,10,30,0.85)] backdrop-blur-sm border border-[rgba(0,212,255,0.2)] rounded-lg p-3 min-w-[200px]"
          >
            <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-2">Crew</div>
            <div className="flex flex-col gap-2">
              {CREW.map((member) => (
                <div key={member.name} className="flex flex-col">
                  <span className="text-sm font-mono text-white">{member.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider text-gray-400">
                      {member.role}
                    </span>
                    <span className={`text-[10px] ${member.agency === 'CSA' ? 'text-[#ff8c00]' : 'text-gray-500'}`}>
                      {member.agency}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
});
