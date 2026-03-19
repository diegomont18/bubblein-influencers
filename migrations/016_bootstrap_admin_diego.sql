-- Bootstrap diego@aihubstudio as admin
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'diego@aihubstudio.com'
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
