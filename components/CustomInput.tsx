import React from 'react'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form'
import { Input } from './ui/input'

import { Control, FieldPath } from 'react-hook-form'
import { z } from 'zod'
import { authFormSchema } from '@/lib/utils'

type AuthFormValues = z.infer<ReturnType<typeof authFormSchema>>

// Helps password managers and mobile keyboards fill the right fields
const autoCompleteFor: Partial<Record<FieldPath<AuthFormValues>, string>> = {
  firstName: 'given-name',
  lastName: 'family-name',
  address1: 'address-line1',
  city: 'address-level2',
  state: 'address-level1',
  postalCode: 'postal-code',
  dateOfBirth: 'bday',
  ssn: 'off',
  email: 'email',
}

interface CustomInput {
  control: Control<AuthFormValues>,
  name: FieldPath<AuthFormValues>,
  label: string,
  placeholder: string
}

const CustomInput = ({ control, name, label, placeholder }: CustomInput) => {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="form-item space-y-0">
          <FormLabel className="form-label">
            {label}
          </FormLabel>
          <div className="flex w-full flex-col">
            <FormControl>
              <Input
                placeholder={placeholder}
                className="input-class aria-invalid:border-red-500"
                type={name === 'password' ? 'password' : name === 'email' ? 'email' : 'text'}
                autoComplete={autoCompleteFor[name]}
                {...field}
              />
            </FormControl>
            <FormMessage className="form-message mt-2" />
          </div>
        </FormItem>
      )}
    />
  )
}

export default CustomInput