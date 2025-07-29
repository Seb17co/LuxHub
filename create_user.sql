-- Create user in auth.users table
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
  'authenticated',
  'authenticated',
  'sebastian@luxkids.dk',
  crypt('123456', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(),
  now(),
  '',
  '',
  '',
  ''
);

-- Create user profile in public.users table with admin role
INSERT INTO public.users (
  id,
  role,
  email,
  created_at
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
  'admin',
  'sebastian@luxkids.dk',
  now()
);

-- Create an identity record
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
  '{"sub":"a1b2c3d4-e5f6-7890-abcd-ef1234567890","email":"sebastian@luxkids.dk"}',
  'email',
  now(),
  now(),
  now()
);
