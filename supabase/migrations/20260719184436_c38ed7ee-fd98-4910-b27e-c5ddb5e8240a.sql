CREATE TYPE public.tipo_proponente AS ENUM ('pessoa_fisica', 'pessoa_juridica_ou_coletivo');

GRANT USAGE ON TYPE public.tipo_proponente TO authenticated;
GRANT USAGE ON TYPE public.tipo_proponente TO service_role;

ALTER TABLE public.proponents
  ADD COLUMN tipo_proponente public.tipo_proponente;
