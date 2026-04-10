interface PhoneInputProps {
  value: string;
  onChange: (val: string) => void;
}

export default function PhoneInput({ value, onChange }: PhoneInputProps) {
  return (
    <div>
      <input
        type="tel"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="+1 (555) 123-4567"
        className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
      />
      <p className="mt-1 text-xs text-gray-400">Include country code if available</p>
    </div>
  );
}
