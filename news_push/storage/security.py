"""
Encryption utilities for secure storage.

Uses Fernet symmetric encryption for sensitive data.
"""

import os
import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC


class SecureStorage:
    """Secure storage with encryption/decryption capabilities."""

    def __init__(self, password: str = None):
        """
        Initialize SecureStorage.

        Args:
            password: Password for encryption. If None, reads from environment variable.

        Raises:
            ValueError: If no password is provided and NEWS_PUSH_ENCRYPTION_KEY is not set.
        """
        if password is None:
            password = os.environ.get('NEWS_PUSH_ENCRYPTION_KEY')

        if not password:
            raise ValueError(
                "Encryption password not provided. "
                "Set NEWS_PUSH_ENCRYPTION_KEY environment variable or pass password directly."
            )

        # Derive key from password
        self._key = self._derive_key(password)
        self.cipher = Fernet(self._key)

    def _derive_key(self, password: str) -> bytes:
        """
        Derive a 32-byte key from password using PBKDF2.

        Args:
            password: Password string

        Returns:
            32-byte key suitable for Fernet
        """
        # Use a fixed salt for simplicity (in production, use random salt per instance)
        salt = b'news-push-skill-salt'
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(password.encode()))
        return key

    def encrypt(self, plaintext: str) -> str:
        """
        Encrypt plaintext string.

        Args:
            plaintext: String to encrypt

        Returns:
            Encrypted string (base64 encoded)

        Raises:
            ValueError: If plaintext is None
        """
        if plaintext is None:
            raise ValueError("Cannot encrypt None value")

        if not plaintext:
            # Return empty string for empty input
            return ""

        encrypted_bytes = self.cipher.encrypt(plaintext.encode())
        return encrypted_bytes.decode()

    def decrypt(self, ciphertext: str) -> str:
        """
        Decrypt ciphertext string.

        Args:
            ciphertext: Encrypted string (base64 encoded)

        Returns:
            Decrypted plaintext string

        Raises:
            ValueError: If ciphertext is None or invalid
        """
        if ciphertext is None:
            raise ValueError("Cannot decrypt None value")

        if not ciphertext:
            # Return empty string for empty input
            return ""

        try:
            decrypted_bytes = self.cipher.decrypt(ciphertext.encode())
            return decrypted_bytes.decode()
        except Exception as e:
            raise ValueError(f"Decryption failed: {e}")

    def encrypt_dict(self, data: dict) -> str:
        """
        Encrypt dictionary as JSON string.

        Args:
            data: Dictionary to encrypt

        Returns:
            Encrypted JSON string
        """
        import json
        json_str = json.dumps(data)
        return self.encrypt(json_str)

    def decrypt_dict(self, ciphertext: str) -> dict:
        """
        Decrypt JSON string to dictionary.

        Args:
            ciphertext: Encrypted JSON string

        Returns:
            Decrypted dictionary
        """
        import json
        json_str = self.decrypt(ciphertext)
        return json.loads(json_str)
