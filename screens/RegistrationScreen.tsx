import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { Button, HelperText, Surface, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RegisteredUser } from '../storage/authStorage';
import { brandColors } from '../theme';

const API_URL = 'http://204.168.156.110:3000/auth/register';
const LOGIN_API_URL = 'http://204.168.156.110:3000/auth/login';
interface RegistrationScreenProps {
  onBack: () => void;
  onRegistered: (user: RegisteredUser, token?: string) => Promise<void> | void;
}

interface RegisterErrorPayload {
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

function extractToken(payload: unknown): string | undefined {
  const root = getRecord(payload);
  const data = getRecord(root?.data);
  const user = getRecord(root?.user);
  const dataUser = getRecord(data?.user);

  for (const record of [root, data, user, dataUser]) {
    const token = getStringValue(record, ['access_token', 'accessToken', 'token']);
    if (token) {
      return token;
    }
  }

  return undefined;
}

async function loginAfterRegistration(email: string, password: string): Promise<string | undefined> {
  const response = await fetch(LOGIN_API_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  const rawResponse = await response.text();
  const parsedResponse = rawResponse ? JSON.parse(rawResponse) : null;

  if (!response.ok) {
    return undefined;
  }

  return extractToken(parsedResponse);
}

function getApiErrorMessage(payload: RegisterErrorPayload | null, status: number): string {
  if (!payload) {
    return `Rekister\u00F6inti ep\u00E4onnistui (HTTP ${status}).`;
  }

  if (typeof payload.message === 'string' && payload.message.trim().length > 0) {
    return payload.message;
  }

  if (Array.isArray(payload.message)) {
    const [firstMessage] = payload.message;

    if (typeof firstMessage === 'string' && firstMessage.trim().length > 0) {
      return firstMessage;
    }
  }

  if (typeof payload.error === 'string' && payload.error.trim().length > 0) {
    return payload.error;
  }

  return `Rekister\u00F6inti ep\u00E4onnistui (HTTP ${status}).`;
}

export default function RegistrationScreen({ onBack, onRegistered }: RegistrationScreenProps) {
  const { width } = useWindowDimensions();
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isCompact = width < 380;
  const horizontalPadding = Math.max(14, Math.min(28, width * 0.06));
  const inputSpacing = isCompact ? 10 : 14;
  const cardPadding = isCompact ? 16 : 22;
  const buttonHeight = isCompact ? 50 : 56;

  const canSubmit = useMemo(() => {
    return (
      username.trim().length > 0 &&
      firstName.trim().length > 0 &&
      lastName.trim().length > 0 &&
      email.trim().length > 0 &&
      password.length > 0
    );
  }, [email, firstName, lastName, password, username]);

  const handleRegister = async () => {
    if (!canSubmit || isSubmitting) {
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    const payload = {
      username: username.trim(),
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim().toLowerCase(),
      password,
    };

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const rawResponse = await response.text();
      let parsedResponse: RegisterErrorPayload | null = null;

      if (rawResponse) {
        try {
          parsedResponse = JSON.parse(rawResponse) as RegisterErrorPayload;
        } catch (error) {
          if (!response.ok) {
            throw error;
          }
        }
      }

      if (!response.ok) {
        throw new Error(getApiErrorMessage(parsedResponse, response.status));
      }

      const tokenFromRegister = extractToken(parsedResponse);
      const token = tokenFromRegister ?? (await loginAfterRegistration(payload.email, password));

      await onRegistered({
        username: payload.username,
        firstName: payload.first_name,
        lastName: payload.last_name,
        email: payload.email,
      }, token);
    } catch (error) {
      if (error instanceof SyntaxError) {
        setErrorMessage('Palvelin palautti odottamattoman vastauksen.');
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('Rekister\u00F6inti ep\u00E4onnistui. Yrit\u00E4 uudelleen.');
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
              label={'Käyttäjänimi'}
              left={<TextInput.Icon icon="account-outline" />}
              mode="outlined"
              onChangeText={setUsername}
              outlineStyle={styles.inputOutline}
              value={username}
            />
            <TextInput
              disabled={isSubmitting}
              label="Etunimi"
              left={<TextInput.Icon icon="badge-account-outline" />}
              mode="outlined"
              onChangeText={setFirstName}
              outlineStyle={styles.inputOutline}
              style={[styles.inputSpacing, { marginTop: inputSpacing }]}
              value={firstName}
            />
            <TextInput
              disabled={isSubmitting}
              label="Sukunimi"
              left={<TextInput.Icon icon="account-details-outline" />}
              mode="outlined"
              onChangeText={setLastName}
              outlineStyle={styles.inputOutline}
              style={[styles.inputSpacing, { marginTop: inputSpacing }]}
              value={lastName}
            />
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
              style={[styles.inputSpacing, { marginTop: inputSpacing }]}
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
              icon="account-plus-outline"
              loading={isSubmitting}
              mode="contained"
              onPress={handleRegister}
              style={styles.primaryButton}
              textColor={brandColors.forest}
              contentStyle={[styles.primaryButtonContent, { minHeight: buttonHeight }]}
            >
              {'Rekister\u00F6idy'}
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
