interface UrlInputProps {
  value: string;
  onChange: (val: string) => void;
}

export default function UrlInput({ value, onChange }: UrlInputProps) {
  const isValid = !value || /^https?:\/\/.+/.test(value);

  return (
    <div>
      <input
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://example.com"
        className={`w-full px-4 py-3 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all ${
          !isValid ? 'border-red-300 bg-red-50' : 'border-gray-300'
        }`}
      />
      {!isValid && (
        <p className="mt-1 text-xs text-red-500">Please enter a valid URL starting with http:// or https://</p>
      )}
    </div>
  );
}
