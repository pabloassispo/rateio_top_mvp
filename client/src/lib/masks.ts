/**
 * Apply CPF mask: 000.000.000-00
 */
export function maskCPF(value: string): string {
  // Remove all non-numeric characters
  const numbers = value.replace(/\D/g, "");
  
  // Apply mask
  if (numbers.length <= 3) {
    return numbers;
  } else if (numbers.length <= 6) {
    return `${numbers.slice(0, 3)}.${numbers.slice(3)}`;
  } else if (numbers.length <= 9) {
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6)}`;
  } else {
    return `${numbers.slice(0, 3)}.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9, 11)}`;
  }
}

/**
 * Extract only numbers from CPF
 */
export function unmaskCPF(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Apply phone mask: (00) 00000-0000
 */
export function maskPhone(value: string): string {
  // Remove all non-numeric characters
  const numbers = value.replace(/\D/g, "");
  
  // Apply mask
  if (numbers.length <= 2) {
    return numbers.length > 0 ? `(${numbers}` : "";
  } else if (numbers.length <= 7) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  } else {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  }
}

/**
 * Extract only numbers from phone
 */
export function unmaskPhone(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Validate CPF (basic validation - 11 digits)
 */
export function validateCPF(cpf: string): boolean {
  const numbers = unmaskCPF(cpf);
  return numbers.length === 11;
}

/**
 * Validate phone (basic validation - 10 or 11 digits)
 */
export function validatePhone(phone: string): boolean {
  const numbers = unmaskPhone(phone);
  return numbers.length === 10 || numbers.length === 11;
}

