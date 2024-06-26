'use server';

import { z } from 'zod';
import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { AuthError } from 'next-auth';
import { signIn } from '@/auth';

const FormSchema = z.object({
    id: z.string({
        invalid_type_error: 'Please select a customer.',
    }),
    customerId: z.string(),
    amount: z.coerce
            .number()
            .gt(0, { message: 'Please enter a number greater than $0' }),
    status: z.enum(['pending', 'paid'], {
        invalid_type_error: 'Please select an invoice status.',
    }),
    date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export type State = {
    errors?: {
        customerId?: string[];
        amount?: string[];
        status?: string[];
    };
    message?: string | null;
};

export const createInvoice = async (prevState: State, formData: FormData) => {
    try {
        const validatedFields = CreateInvoice.safeParse({
            customerId: formData.get('customerId'),
            amount: formData.get('amount'),
            status: formData.get('status'),
        });

        
        if (!validatedFields.success) {
            return {
                errors: validatedFields.error.flatten().fieldErrors,
                message: 'Missing Fields. Failed to create invoice',
            };
        }
        
        const { customerId, amount, status } = validatedFields.data;
        const amountInCents = amount * 100;
        const date = new Date().toISOString().split('T')[0];
        
        await sql`
            INSERT INTO invoices (customer_id, amount, status, date)
            VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
        `;
    
    } catch (err) {
        return {
            message: 'Database Error: Failed to create invoice.',
        };
    }

    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
};


export const updateInvoice = async (id: string, prevState: State, formData: FormData) => {
    try {
        const validatedFields = UpdateInvoice.safeParse({
            customerId: formData.get('customerId'),
            amount: formData.get('amount'),
            status: formData.get('status'),
        });

        if (!validatedFields.success) {
            return {
                errors: validatedFields.error.flatten().fieldErrors,
                message: 'Missing Fields. Failed to update invoice',
            };
        }

        const { customerId, amount, status } = validatedFields.data;
        const amountInCents = amount * 100;
    
        await sql`
            UPDATE invoices
            SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
            WHERE id = ${id}
        `;
    
        revalidatePath('/dashboard/invoices');
    } catch (err) {
       return {
              message: 'Database Error: Failed to update invoice.',
       };
    }
    redirect('/dashboard/invoices');
}

export const deleteInvoice = async (id: string) => {
    try {
        await sql`
        DELETE FROM invoices
        WHERE id = ${id}
        `;
        
        revalidatePath('/dashboard/invoices');
    } catch (err) {
        console.log(`Error: ${err}`);
        throw new Error('Failed to delete invoice');
    }
 }

 export const authenticate = async (prevState: string | undefined, formData: FormData) => {
    try {
        await signIn('credentials', formData);
    } catch (error) {
        if (error instanceof AuthError) {
            switch (error.type) {
                case 'CredentialsSignin':
                    return 'Invalid Credentials';
                default:
                    return 'Something went wrong.'
            }
        }
        throw error;
    }
 }