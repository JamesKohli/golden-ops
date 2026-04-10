interface EnumInputProps {
  options: string[];
  value: string | null;
  onChange: (val: string) => void;
}

export default function EnumInput({ options, value, onChange }: EnumInputProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
            value === option
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
              : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-300 hover:bg-indigo-50'
          }`}
        >
          {option.replace(/_/g, ' ')}
        </button>
      ))}
    </div>
  );
}
