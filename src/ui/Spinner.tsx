type SpinnerProps = {
  size?: number;
  label?: string;
  className?: string;
};

export function Spinner({ size = 16, label = "Carregando", className = "" }: SpinnerProps) {
  return (
    <span role="status" aria-label={label} className={`inline-flex items-center ${className}`}>
      <span className="spinner" style={{ width: size, height: size }} aria-hidden="true" />
    </span>
  );
}
