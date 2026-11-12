import type { CSSProperties, InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "min" | "max" | "step" | "onChange"> & {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
};

/** A range input drawn as a progress bar: the filled part shows the value at a glance. */
export function Slider({ value, min, max, step, onChange, className = "", ...rest }: Props) {
  const fill = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <input
      {...rest}
      type="range"
      className={`bar ${className}`.trim()}
      min={min}
      max={max}
      step={step}
      value={value}
      style={{ "--fill": `${fill}%` } as CSSProperties}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}
