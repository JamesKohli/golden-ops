interface TextInputProps {
  value: string;
  onChange: (val: string) => void;
}

export default function TextInput({ value, onChange }: TextInputProps) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Enter your notes here..."
      rows={4}
      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-y"
    />
  );
}
