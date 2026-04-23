import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ModeCard({ to, kicker, title, description, icon: Icon, accent }) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
    >
      <Link
        to={to}
        className="group relative block overflow-hidden rounded-3xl glass p-6 md:p-8 h-full transition-all hover:ring-1 hover:ring-primary/40"
      >
        <div className="flex items-start justify-between">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${accent ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'}`}>
            <Icon className="w-6 h-6" strokeWidth={2.2} />
          </div>
          <ArrowUpRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 group-hover:-translate-y-1 transition-all" />
        </div>
        <div className="mt-8">
          <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-medium mb-2">
            {kicker}
          </div>
          <h3 className="font-display text-3xl md:text-4xl leading-[0.95]">
            {title}
          </h3>
          <p className="mt-4 text-sm md:text-base text-muted-foreground leading-relaxed max-w-sm">
            {description}
          </p>
        </div>
      </Link>
    </motion.div>
  );
}