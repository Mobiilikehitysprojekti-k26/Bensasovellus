import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { Button, HelperText, Surface, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RegisteredUser } from '../storage/authStorage';
import { brandColors } from '../theme';

const API_URL = 'http://204.168.156.110:3000/auth/login';

interface LoginScreenProps {
  onBack: () => void;
  onLoggedIn: (user: RegisteredUser, token?: string) => Promise<void> | void;
  storedUser: RegisteredUser | null;
}

interface ApiErrorPayload {
  message?: string | string[];
  error?: string;
  [key: string]: unknown;
}

function getRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function getStringValue(record: Record<string, unknown> | null, keys: string[]): string | null {
  if (!record) {
    return null;
  }

  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function getNestedRecords(payload: unknown): Array<Record<string, unknown>> {
  const root = getRecord(payload);
  const data = getRecord(root?.data);
  const user = getRecord(root?.user);
  const dataUser = getRecord(data?.user);
  const profile = getRecord(root?.profile);

  return [root, data, user, dataUser, profile].filter(
    (value): value is Record<string, unknown> => value !== null
  );
}

function getApiErrorMessage(payload: ApiErrorPayload | null, status: number): string {
  if (typeof payload?.message === 'string' && payload.message.trim().length > 0) {
    return payload.message;
  }

  if (Array.isArray(payload?.message)) {
    const [firstMessage] = payload.message;
    if (typeof firstMessage === 'string' && firstMessage.trim().length > 0) {
      return firstMessage;
    }
  }

  if (typeof payload?.error === 'string' && payload.error.trim().length > 0) {
    return payload.error;
  }

  if (status === 401) {
    return 'Virheellinen s\u00E4hk\u00F6posti tai salasana.';
  }

  return `Kirjautuminen ep\u00E4onnistui (HTTP ${status}).`;
}

function extractToken(payload: unknown): string | undefined {
  const records = getNestedRecords(payload);

  for (const record of records) {
    const token = getStringValue(record, ['access_token', 'accessToken', 'token']);
    if (token) {
      return token;
    }
  }

  return undefined;
}

function extractUser(
  payload: unknown,
  email: string,
  storedUser: RegisteredUser | null
): RegisteredUser {
  const records = getNestedRecords(payload);
  const matchingStoredUser =
    storedUser && storedUser.email.toLowerCase() === email.toLowerCase() ? storedUser : null;

  let username: string | null = null;
  let firstName: string | null = null;
  let lastName: string | null = null;
  let resolvedEmail: string | null = null;

  for (const record of records) {
    username ??= getStringValue(record, ['username', 'userName']);
    firstName ??= getStringValue(record, ['first_name', 'firstName', 'given_name']);
    lastName ??= getStringValue(record, ['last_name', 'lastName', 'family_name']);
    resolvedEmail ??= getStringValue(record, ['email']);
  }

  const normalizedEmail = (resolvedEmail ?? matchingStoredUser?.email ?? email).toLowerCase();

  return {
    username:
      username ??
      matchingStoredUser?.username ??
      normalizedEmail.split('@')[0] ??
      'kayttaja',
    firstName: firstName ?? matchingStoredUser?.firstName ?? '',
    lastName: lastName ?? matchingStoredUser?.lastName ?? '',
    email: normalizedEmail,
  };
}

export default function LoginScreen({
  onBack,
  onLoggedIn,
  storedUser,
}: LoginScreenProps) {
  const { width } = useWindowDimensions();
  const [email, setEmail] = useState(storedUser?.email ?? '');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isCompact = width < 380;
  const horizontalPadding = Math.max(14, Math.min(28, width * 0.06));
  const inputSpacing = isCompact ? 10 : 14;
  const cardPadding = isCompact ? 16 : 22;
  const buttonHeight = isCompact ? 50 : 56;

  const canSubmit = useMemo(() => {
    return email.trim().length > 0 && password.length > 0;
  }, [email, password]);

  const handleLogin = async () => {
    if (!canSubmit || isSubmitting) {
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    const normalizedEmail = email.trim().toLowerCase();

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: normalizedEmail,
          password,
        }),
      });

      const rawResponse = await response.text();
      let parsedResponse: ApiErrorPayload | null = null;

      if (rawResponse) {
        try {
          parsedResponse = JSON.parse(rawResponse) as ApiErrorPayload;
        } catch (error) {
          if (!response.ok) {
            throw error;
          }
        }
      }

      if (!response.ok) {
        throw new Error(getApiErrorMessage(parsedResponse, response.status));
      }

      const user = extractUser(parsedResponse, normalizedEmail, storedUser);
      const token = extractToken(parsedResponse);

      await onLoggedIn(user, token);
    } catch (error) {
      if (error instanceof SyntaxError) {
        setErrorMessage('Palvelin palautti odottamattoman vastauksen.');
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Kirjautuminen ep\u00E4onnistui. Yrit\u00E4 uudelleen.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              justifyContent: 'center',
              paddingHorizontal: horizontalPadding,
              paddingVertical: isCompact ? 16 : 24,
            },
          ]}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Surface style={[styles.card, { padding: cardPadding }]} elevation={2}>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              disabled={isSubmitting}
              keyboardType="email-address"
              label={'S\u00E4hk\u00F6posti'}
              left={<TextInput.Icon icon="email-outline" />}
              mode="outlined"
              onChangeText={setEmail}
              outlineStyle={styles.inputOutline}
              value={email}
            />
            <TextInput
              autoCapitalize="none"
              disabled={isSubmitting}
              label="Salasana"
              left={<TextInput.Icon icon="lock-outline" />}
              mode="outlined"
              onChangeText={setPassword}
              outlineStyle={styles.inputOutline}
              secureTextEntry
              style={[styles.inputSpacing, { marginTop: inputSpacing }]}
              value={password}
            />

            <HelperText style={styles.helperText} type="error" visible={Boolean(errorMessage)}>
              {errorMessage ?? ' '}
            </HelperText>

            <Button
              buttonColor={brandColors.mint}
              disabled={!canSubmit || isSubmitting}
              icon="login"
              loading={isSubmitting}
              mode="contained"
              onPress={handleLogin}
              style={styles.primaryButton}
              textColor={brandColors.forest}
              contentStyle={[styles.primaryButtonContent, { minHeight: buttonHeight }]}
            >
              Kirjaudu
            </Button>

            <Button mode="text" onPress={onBack} textColor={brandColors.forestSoft}>
              Takaisin
            </Button>
          </Surface>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: brandColors.whisperMint,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  card: {
    alignSelf: 'center',
    backgroundColor: '#F9FFFC',
    borderColor: brandColors.lightMint,
    borderRadius: 32,
    borderWidth: 1,
    maxWidth: 520,
    width: '100%',
  },
  inputOutline: {
    borderRadius: 18,
  },
  inputSpacing: {
    marginTop: 14,
  },
  helperText: {
    marginBottom: 4,
    marginTop: 10,
    paddingHorizontal: 4,
  },
  primaryButton: {
    borderRadius: 18,
    marginBottom: 8,
    marginTop: 6,
  },
  primaryButtonContent: {
    minHeight: 56,
  },
});
