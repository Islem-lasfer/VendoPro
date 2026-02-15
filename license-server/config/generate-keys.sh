# Generate a 2048-bit RSA private key for license signing
# Run this on your secure server, never share the private key
openssl genpkey -algorithm RSA -out private_key.pem -pkeyopt rsa_keygen_bits:2048
# Extract the public key for embedding in the client
openssl rsa -in private_key.pem -pubout -out public_key.pem
