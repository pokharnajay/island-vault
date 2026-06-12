interface Props {
  value: string
  onChange: (v: string) => void
}

export default function SearchBar({ value, onChange }: Props) {
  return (
    <input
      className="search"
      type="text"
      placeholder="Search clips…"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      spellCheck={false}
    />
  )
}
