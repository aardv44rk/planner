import {
  forwardRef,
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';

export type Size = 'xs' | 'sm' | 'md' | 'lg' | 'compact-xs' | 'compact-sm';

export type ButtonVariant = 'filled' | 'default' | 'subtle' | 'light';

export type ButtonColor = 'red' | 'orange' | 'yellow' | 'green' | 'gray';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: Size;
  variant?: ButtonVariant;
  color?: ButtonColor;
  loading?: boolean;
  leftSection?: ReactNode;
  rightSection?: ReactNode;
  px?: number;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    size = 'xs',
    variant = 'filled',
    color,
    loading = false,
    disabled = false,
    leftSection,
    rightSection,
    px,
    children,
    className = '',
    style,
    type = 'button',
    ...props
  },
  ref,
) {
  // Variant classes mapped to reference design tokens
  let variantClasses = 'bg-accent text-white hover:bg-accent-hover';
  if (variant === 'default' || variant === 'light') {
    variantClasses = 'bg-accent-soft text-accent hover:bg-[color-mix(in_srgb,var(--accent)_15%,var(--accent-soft))]';
  } else if (variant === 'subtle') {
    variantClasses = 'bg-transparent text-accent hover:bg-accent-soft';
  }

  // Color overrides
  if (color === 'red') {
    if (variant === 'filled') {
      variantClasses = 'bg-danger text-white hover:opacity-90';
    } else {
      variantClasses = 'bg-danger-soft text-danger hover:opacity-80';
    }
  } else if (color === 'gray') {
    if (variant === 'subtle') {
      variantClasses = 'bg-transparent text-muted hover:text-tx-primary hover:bg-surface-3';
    } else {
      variantClasses = 'bg-surface-3 text-tx-primary hover:bg-elevated';
    }
  } else if (color === 'green') {
    variantClasses = 'bg-ok-soft text-ok hover:opacity-90';
  } else if (color === 'yellow' || color === 'orange') {
    variantClasses = 'bg-warn-soft text-warn hover:opacity-90';
  }

  // Size classes
  let sizeClasses = 'h-[30px] min-h-[30px] px-3 text-xs';
  if (size === 'sm') sizeClasses = 'h-[34px] min-h-[34px] px-3.5 text-xs';
  if (size === 'md') sizeClasses = 'h-[38px] min-h-[38px] px-4 text-sm';
  if (size === 'compact-xs') sizeClasses = 'h-[22px] min-h-[22px] px-2 text-[11px]';
  if (size === 'compact-sm') sizeClasses = 'h-[26px] min-h-[26px] px-2.5 text-xs';

  return (
    <button
      {...props}
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`uiButton inline-flex items-center justify-center gap-1.5 font-semibold rounded-[var(--radius-control)] border border-transparent select-none cursor-default active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none ${sizeClasses} ${variantClasses} ${className}`}
      style={{ paddingInline: px, ...style }}
    >
      {loading ? (
        <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin mr-1" />
      ) : (
        leftSection
      )}
      {children}
      {rightSection}
    </button>
  );
});

export const UiButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  function UiButton({ className = '', type = 'button', ...props }, ref) {
    return (
      <button
        {...props}
        ref={ref}
        type={type}
        className={`uiUnstyledButton border-0 bg-transparent p-0 text-inherit text-left font-inherit cursor-default select-none ${className}`}
      />
    );
  },
);

export const CloseButton = ({
  className = '',
  'aria-label': ariaLabel = 'Close',
  ...props
}: ButtonProps) => (
  <Button
    {...props}
    variant="subtle"
    color="gray"
    className={`w-7 h-7 min-h-[28px] p-0 rounded-[var(--radius-chip)] text-muted hover:text-danger hover:bg-danger-soft transition-colors ${className}`}
    aria-label={ariaLabel}
  >
    <span className="text-base leading-none select-none">×</span>
  </Button>
);

export interface FieldProps {
  label?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  id?: string;
  className?: string;
  children?: ReactNode;
}

export function Field({
  label,
  description,
  error,
  id,
  className = '',
  children,
}: FieldProps) {
  return (
    <div className={`uiField flex flex-col space-y-1 min-w-0 ${className}`}>
      {label && (
        <label className="text-xs font-semibold text-tx-primary select-none" htmlFor={id}>
          {label}
        </label>
      )}
      {description && (
        <div id={`${id}-description`} className="text-[11px] text-muted">
          {description}
        </div>
      )}
      {children}
      {error && (
        <div id={`${id}-error`} className="text-[11px] text-danger font-medium">
          {error}
        </div>
      )}
    </div>
  );
}

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: 'xs' | 'sm' | 'md';
  rightSection?: ReactNode;
  leftSection?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { size = 'xs', rightSection, leftSection, className = '', ...props },
  ref,
) {
  const heightClass = size === 'xs' ? 'h-[30px]' : size === 'sm' ? 'h-[34px]' : 'h-[38px]';
  const textClass = size === 'xs' ? 'text-xs' : 'text-sm';

  return (
    <div className="relative flex items-center w-full min-w-0">
      {leftSection && (
        <span className="absolute left-2.5 flex items-center pointer-events-none text-muted">
          {leftSection}
        </span>
      )}
      <input
        {...props}
        ref={ref}
        className={`uiInput w-full rounded-[var(--radius-control)] border border-subtle bg-surface text-tx-primary placeholder:text-muted/60 transition-colors focus:outline-none focus:border-accent disabled:bg-surface-3 disabled:opacity-60 ${heightClass} ${textClass} ${
          leftSection ? 'pl-8' : 'pl-3'
        } ${rightSection ? 'pr-8' : 'pr-3'} ${className}`}
      />
      {rightSection && (
        <span className="absolute right-2.5 flex items-center pointer-events-none text-muted">
          {rightSection}
        </span>
      )}
    </div>
  );
});

export const TextInput = forwardRef<HTMLInputElement, InputProps & FieldProps>(
  function TextInput(
    { label, description, error, id: suppliedId, className = '', ...props },
    ref,
  ) {
    const generatedId = useId();
    const id = suppliedId ?? generatedId;
    return (
      <Field id={id} label={label} description={description} error={error} className={className}>
        <Input {...props} ref={ref} id={id} />
      </Field>
    );
  },
);

export type TagRole = 'neutral' | 'accent' | 'ok' | 'warn' | 'danger';

export interface TagProps {
  tone?: TagRole;
  variant?: 'soft' | 'outline' | 'solid';
  className?: string;
  children: ReactNode;
}

export function Tag({
  tone = 'neutral',
  variant = 'soft',
  className = '',
  children,
}: TagProps) {
  let toneClass = 'bg-surface-3 text-muted';
  if (tone === 'accent') {
    toneClass = variant === 'solid' ? 'bg-accent text-white' : 'bg-accent-soft text-accent';
  } else if (tone === 'ok') {
    toneClass = variant === 'solid' ? 'bg-ok text-white' : 'bg-ok-soft text-ok';
  } else if (tone === 'warn') {
    toneClass = variant === 'solid' ? 'bg-warn text-white' : 'bg-warn-soft text-warn';
  } else if (tone === 'danger') {
    toneClass = variant === 'solid' ? 'bg-danger text-white' : 'bg-danger-soft text-danger';
  }

  if (variant === 'outline') {
    toneClass = `bg-transparent border border-current ${
      tone === 'accent'
        ? 'text-accent'
        : tone === 'ok'
        ? 'text-ok'
        : tone === 'warn'
        ? 'text-warn'
        : tone === 'danger'
        ? 'text-danger'
        : 'text-muted border-subtle'
    }`;
  }

  return (
    <span
      className={`uiTag inline-flex items-center justify-center px-1.5 py-0.5 rounded-[var(--radius-chip)] text-[11px] font-semibold leading-none tabular-nums whitespace-nowrap select-none ${toneClass} ${className}`}
    >
      {children}
    </span>
  );
}

export const Badge = Tag;
