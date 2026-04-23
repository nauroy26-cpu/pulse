import React from 'react';
import { User } from 'lucide-react';

export default function PseudoField({ value, onChange, disabled, placeholder = "Ton pseudo", autoFocus }) {
  return (
    <div className="relative">
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
        <User className="w-5 h-5" />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full h-14 bg-secondary/40 border border-border rounded-xl pl-12 pr-4 font-mono text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary disabled:opacity-60 transition"
      />
    </div>
  );
}