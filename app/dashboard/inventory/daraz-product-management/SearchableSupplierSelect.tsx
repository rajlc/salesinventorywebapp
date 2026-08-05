'use client'

import Select from 'react-select'

interface SupplierOption {
    value: string
    label: string
}

interface SearchableSupplierSelectProps {
    suppliers: Array<{ id: string; supplier_name: string }>
    value: string
    onChange: (value: string) => void
    placeholder?: string
    isDisabled?: boolean
}

export default function SearchableSupplierSelect({
    suppliers,
    value,
    onChange,
    placeholder = 'Search & Select Supplier...',
    isDisabled = false
}: SearchableSupplierSelectProps) {
    const options: SupplierOption[] = suppliers.map(s => ({
        value: s.id,
        label: s.supplier_name
    }))

    const selectedOption = options.find(o => o.value === value) || null

    const customSelectStyles = {
        control: (base: any, state: any) => ({
            ...base,
            minHeight: '34px',
            fontSize: '0.8125rem',
            borderColor: state.isFocused ? '#f97316' : '#e5e7eb',
            borderRadius: '0.375rem',
            backgroundColor: 'white',
            boxShadow: 'none',
            '&:hover': {
                borderColor: '#f97316'
            }
        }),
        valueContainer: (base: any) => ({
            ...base,
            padding: '0 8px',
        }),
        input: (base: any) => ({
            ...base,
            margin: '0',
            padding: '0'
        }),
        indicatorsContainer: (base: any) => ({
            ...base,
        }),
        menuPortal: (base: any) => ({ ...base, zIndex: 99999 }),
        menu: (base: any) => ({
            ...base,
            zIndex: 99999,
            fontSize: '0.8125rem'
        }),
        option: (base: any, state: any) => ({
            ...base,
            backgroundColor: state.isSelected
                ? '#ea580c'
                : state.isFocused
                ? '#ffedd5'
                : 'white',
            color: state.isSelected ? 'white' : '#1f2937',
            cursor: 'pointer',
            fontSize: '0.8125rem'
        }),
        singleValue: (base: any) => ({
            ...base,
            color: '#1f2937'
        }),
        placeholder: (base: any) => ({
            ...base,
            color: '#9ca3af',
            fontSize: '0.8125rem'
        })
    }

    return (
        <Select
            options={options}
            value={selectedOption}
            onChange={(opt: any) => onChange(opt ? opt.value : '')}
            isClearable
            isSearchable
            isDisabled={isDisabled}
            placeholder={placeholder}
            styles={customSelectStyles}
            menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
            menuPosition="fixed"
        />
    )
}
