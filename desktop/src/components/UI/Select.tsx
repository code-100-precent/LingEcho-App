import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/utils/cn.ts'

interface SelectProps {
  value: string
  onValueChange: (value: string) => void
  children: React.ReactNode
  disabled?: boolean
  className?: string
}

interface SelectTriggerProps {
  children: React.ReactNode
  className?: string
}

interface SelectContentProps {
  children: React.ReactNode
  className?: string
}

interface SelectItemProps {
  value: string
  children: React.ReactNode
  className?: string
}

interface SelectValueProps {
  placeholder?: string
  children?: React.ReactNode
}

const Select: React.FC<SelectProps> = ({
                                           value,
                                           onValueChange,
                                           children,
                                           disabled = false,
                                           className = ''
                                       }) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleItemClick = (itemValue: string) => {
        onValueChange(itemValue); // Trigger the onValueChange to update the value
        setIsOpen(false); // Close dropdown after selecting an item
    };

    return (
        <div ref={selectRef} className={cn('relative', className)}>
            {React.Children.map(children, (child) => {
                if (React.isValidElement(child)) {
                    if (child.type === SelectTrigger) {
                        return React.cloneElement(child, {
                            onClick: () => !disabled && setIsOpen(!isOpen),
                            isOpen,
                            disabled,
                            selectedValue: value
                        });
                    } else if (child.type === SelectContent) {
                        return isOpen ? React.cloneElement(child, {
                            onItemClick: handleItemClick,
                            selectedValue: value
                        }) : null;
                    }
                }
                return child;
            })}
        </div>
    );
};
const SelectTrigger: React.FC<SelectTriggerProps & { onClick?: () => void; isOpen?: boolean; disabled?: boolean; selectedValue?: string }> = ({
                                                                                                                                                  className = '',
                                                                                                                                                  onClick,
                                                                                                                                                  isOpen = false,
                                                                                                                                                  disabled = false,
                                                                                                                                                  selectedValue
                                                                                                                                              }) => {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={cn(
                'flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                isOpen && 'ring-2 ring-primary ring-offset-2',
                className
            )}
        >
            <SelectValue>{selectedValue}</SelectValue> {/* Render the selected value */}
            <ChevronDown className={cn('h-4 w-4 opacity-50 transition-transform', isOpen && 'rotate-180')} />
        </button>
    );
};

const SelectValue: React.FC<SelectValueProps> = ({ placeholder, children }) => {
    return <span>{children || placeholder}</span>; // Render either the selected value or placeholder
};


const SelectContent: React.FC<SelectContentProps & { onItemClick?: (value: string) => void; selectedValue?: string }> = ({
                                                                                                                             children,
                                                                                                                             className = '',
                                                                                                                             onItemClick,
                                                                                                                             selectedValue}) => {
    return (
        <div className={cn(
            'absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg',
            className
        )}>
            {React.Children.map(children, (child) => {
                if (React.isValidElement(child) && child.type === SelectItem) {
                    return React.cloneElement(child, {
                        onClick: () => onItemClick?.(child.props.value),
                        isSelected: child.props.value === selectedValue
                    });
                }
                return child;
            })}
        </div>
    );
};
const SelectItem: React.FC<SelectItemProps & { onClick?: () => void; isSelected?: boolean }> = ({
                                                                                                    children,
                                                                                                    className = '',
                                                                                                    onClick,
                                                                                                    isSelected = false
                                                                                                }) => {
    return (
        <button
            type="button"
            onClick={onClick} // Trigger onItemClick passed from Select
            className={cn(
                'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-gray-100 focus:bg-gray-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
                isSelected && 'bg-primary/10 text-primary',
                className
            )}
        >
            {isSelected && (
                <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
          <Check className="h-4 w-4" />
        </span>
            )}
            {children}
        </button>
    );
};

export { Select, SelectTrigger, SelectContent, SelectItem, SelectValue }
