// Desbloqueio biométrico com WebAuthn + extensão PRF.
// A PRF devolve um segredo estável por credencial, que usamos para embrulhar a chave
// do diário. Sem PRF não há como derivar uma chave da biometria com segurança, então
// nesse caso a biometria simplesmente não é oferecida.
import { fromB64, randomBytes, toB64 } from "./crypto";

export type BioConfig = { credentialId: string; prfSalt: string };

type PrfOutputs = { enabled?: boolean; results?: { first?: ArrayBuffer } };

export async function biometricAvailable(): Promise<boolean> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

async function evaluate(credentialId: Uint8Array<ArrayBuffer>, salt: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const cred = (await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32),
      allowCredentials: [{ id: credentialId, type: "public-key" }],
      userVerification: "required",
      timeout: 60_000,
      extensions: { prf: { eval: { first: salt } } } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;
  const prf = (cred?.getClientExtensionResults() as { prf?: PrfOutputs })?.prf;
  const first = prf?.results?.first;
  if (!first) throw new Error("Este dispositivo não suporta a extensão PRF do WebAuthn.");
  return new Uint8Array(first);
}

/** Cadastra a biometria e devolve a configuração + o segredo PRF. */
export async function registerBiometric(): Promise<{ config: BioConfig; secret: Uint8Array<ArrayBuffer> }> {
  const salt = randomBytes(32);
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: randomBytes(32),
      rp: { name: "Diário Seguro" },
      user: { id: randomBytes(16), name: "diario", displayName: "Diário Seguro" },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "preferred" },
      timeout: 60_000,
      extensions: { prf: { eval: { first: salt } } } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("Cadastro cancelado.");
  const prf = (cred.getClientExtensionResults() as { prf?: PrfOutputs }).prf;
  if (prf && prf.enabled === false) throw new Error("Este autenticador não suporta derivação de chave (PRF).");
  const id = new Uint8Array(cred.rawId);
  const first = prf?.results?.first;
  const secret = first ? new Uint8Array(first) : await evaluate(id, salt);
  return { config: { credentialId: toB64(id), prfSalt: toB64(salt) }, secret };
}

export async function getBiometricSecret(config: BioConfig): Promise<Uint8Array<ArrayBuffer>> {
  return evaluate(fromB64(config.credentialId), fromB64(config.prfSalt));
}
