/**
 * Tipos de dominio para especialidades y subcategorías.
 */

export interface Specialty {
  id: string;
  name: string;
  code: string;
}

export interface Subcategory {
  id: string;
  user_id: string;
  specialty_id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface SubcategoryWithSpecialty extends Subcategory {
  specialty: Specialty;
}
