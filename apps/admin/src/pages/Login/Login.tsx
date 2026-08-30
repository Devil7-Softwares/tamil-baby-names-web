import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import { ORPCError } from '@orpc/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoginSchema } from '@tbn/shared';
import { useFormik } from 'formik';
import { Navigate } from 'react-router-dom';
import { toFormikValidationSchema } from 'zod-formik-adapter';

import { orpc } from '~/api/orpc';
import { LoadingOverlay, useAuth } from '~/components';

const messageFor = (error: unknown): string =>
    error instanceof ORPCError
        ? error.message
        : 'Could not reach the server. Please try again.';

const Login: React.FC = () => {
    const { user, isLoading, isUnavailable } = useAuth();
    const queryClient = useQueryClient();

    const login = useMutation(
        orpc.admin.auth.login.mutationOptions({
            onSuccess: (data) => {
                // Seeds `me` from the login response, so the redirect below does
                // not flash the loading overlay while it refetches.
                queryClient.setQueryData(orpc.admin.auth.me.queryKey(), data);
            },
        }),
    );

    const form = useFormik({
        initialValues: { email: '', password: '' },
        validationSchema: toFormikValidationSchema(LoginSchema),
        onSubmit: (values) => login.mutateAsync(values).catch(() => undefined),
    });

    if (isLoading) {
        return <LoadingOverlay />;
    }

    if (user) {
        return <Navigate to='/' replace />;
    }

    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                p: 2,
            }}
        >
            <Card sx={{ width: '100%', maxWidth: 400 }}>
                <CardContent component='form' onSubmit={form.handleSubmit}>
                    <Stack spacing={2}>
                        <Typography variant='h5' sx={{ fontWeight: 600 }}>
                            Tamil Baby Names
                        </Typography>

                        <Typography variant='body2' color='text.secondary'>
                            Sign in to manage the catalogue.
                        </Typography>

                        {isUnavailable && (
                            <Alert severity='warning'>
                                The admin area is not configured on the server.
                            </Alert>
                        )}

                        {login.isError && (
                            <Alert severity='error'>
                                {messageFor(login.error)}
                            </Alert>
                        )}

                        <TextField
                            name='email'
                            label='Email'
                            type='email'
                            autoComplete='username'
                            autoFocus
                            value={form.values.email}
                            onChange={form.handleChange}
                            onBlur={form.handleBlur}
                            error={form.touched.email && !!form.errors.email}
                            helperText={form.touched.email && form.errors.email}
                            fullWidth
                        />

                        <TextField
                            name='password'
                            label='Password'
                            type='password'
                            autoComplete='current-password'
                            value={form.values.password}
                            onChange={form.handleChange}
                            onBlur={form.handleBlur}
                            error={
                                form.touched.password && !!form.errors.password
                            }
                            helperText={
                                form.touched.password && form.errors.password
                            }
                            fullWidth
                        />

                        <Button
                            type='submit'
                            variant='contained'
                            size='large'
                            disabled={login.isPending || isUnavailable}
                        >
                            {login.isPending ? 'Signing in…' : 'Sign in'}
                        </Button>
                    </Stack>
                </CardContent>
            </Card>
        </Box>
    );
};

export default Login;
