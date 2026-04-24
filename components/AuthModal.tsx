import React, { useEffect } from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../lib/supabase/client';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/account` : undefined;
    useEffect(() => {
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_IN') {
                if (onSuccess) onSuccess();
                onClose();
            }
        });

        return () => subscription.unsubscribe();
    }, [onClose, onSuccess]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-bg border border-surface p-8 rounded-xl w-full max-w-md space-y-6 relative shadow-2xl">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-2xl text-text-muted hover:text-text leading-none transition-colors"
                    aria-label="Close"
                >
                    &times;
                </button>
                <div className="text-center space-y-2 mb-8">
                    <h2 className="text-xl text-text">登录 / 注册</h2>
                </div>
                <Auth
                    supabaseClient={supabase}
                    redirectTo={redirectTo}
                    appearance={{
                        theme: ThemeSupa,
                        variables: {
                            default: {
                                colors: {
                                    brand: 'var(--color-primary)',
                                    brandAccent: 'var(--color-primary-hover)',
                                    brandButtonText: 'var(--color-bg)',
                                    defaultButtonBackground: 'var(--color-surface)',
                                    defaultButtonBackgroundHover: 'var(--color-border)',
                                    defaultButtonBorder: 'var(--color-border)',
                                    defaultButtonText: 'var(--color-text)',
                                    dividerBackground: 'var(--color-surface)',
                                    inputBackground: 'var(--color-surface)',
                                    inputBorder: 'var(--color-border)',
                                    inputBorderHover: 'var(--color-primary)',
                                    inputBorderFocus: 'var(--color-primary)',
                                    inputText: 'var(--color-text)',
                                    inputLabelText: 'var(--color-text-muted)',
                                    inputPlaceholder: 'var(--color-text-muted)',
                                    messageText: 'var(--color-text)',
                                    messageTextDanger: 'red',
                                    anchorTextColor: 'var(--color-text-muted)',
                                    anchorTextHoverColor: 'var(--color-text)',
                                },
                                space: {
                                    buttonPadding: '12px 16px',
                                    inputPadding: '12px 16px',
                                },
                                borderWidths: {
                                    buttonBorderWidth: '1px',
                                    inputBorderWidth: '1px',
                                },
                                radii: {
                                    borderRadiusButton: '8px',
                                    buttonBorderRadius: '8px',
                                    inputBorderRadius: '8px',
                                },
                                fontSizes: {
                                    baseBodySize: '14px',
                                    baseInputSize: '14px',
                                    baseLabelSize: '14px',
                                    baseButtonSize: '14px',
                                }
                            },
                        },
                        className: {
                            button: 'transition-colors !bg-text !text-bg hover:!opacity-90',
                            input: 'transition-colors',
                            label: 'mb-2 block',
                        }
                    }}
                    theme="dark"
                    providers={[]}
                    localization={{
                        variables: {
                            sign_in: {
                                email_label: '邮箱',
                                password_label: '密码',
                                email_input_placeholder: '你的邮箱地址',
                                password_input_placeholder: '你的密码',
                                button_label: '登录',
                                loading_button_label: '登录中...',
                                social_provider_text: '使用 {{provider}} 登录',
                                link_text: '已有账号？点击登录',
                            },
                            sign_up: {
                                email_label: '邮箱',
                                password_label: '密码',
                                email_input_placeholder: '你的邮箱地址',
                                password_input_placeholder: '你的密码',
                                button_label: '注册',
                                loading_button_label: '注册中...',
                                social_provider_text: '使用 {{provider}} 注册',
                                link_text: '没有账号？点击注册',
                            },
                            forgotten_password: {
                                email_label: '邮箱',
                                password_label: '密码',
                                email_input_placeholder: '你的邮箱地址',
                                button_label: '发送重置密码邮件',
                                loading_button_label: '发送中 ...',
                                link_text: '忘记密码？',
                            }
                        },
                    }}
                />
            </div>
        </div>
    );
};
