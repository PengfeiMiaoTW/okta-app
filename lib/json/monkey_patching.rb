module MonkeyPatching
  module JSON
    module MyJWK
      private
      def to_rsa_key
        # super
        e, n, d, p, q, dp, dq, qi = [:e, :n, :d, :p, :q, :dp, :dq, :qi].collect do |key|
          if self[key]
            OpenSSL::BN.new Base64.urlsafe_decode64(self[key]), 2
          end
        end

        # Public key
        data_sequence = OpenSSL::ASN1::Sequence([
          OpenSSL::ASN1::Integer(n),
          OpenSSL::ASN1::Integer(e),
        ])

        if d && p && q && dp && dq && qi
          data_sequence = OpenSSL::ASN1::Sequence([
            OpenSSL::ASN1::Integer(0),
            OpenSSL::ASN1::Integer(n),
            OpenSSL::ASN1::Integer(e),
            OpenSSL::ASN1::Integer(d),
            OpenSSL::ASN1::Integer(p),
            OpenSSL::ASN1::Integer(q),
            OpenSSL::ASN1::Integer(dp),
            OpenSSL::ASN1::Integer(dq),
            OpenSSL::ASN1::Integer(qi),
          ])
        end

        # asn1 = OpenSSL::ASN1::Sequence(data_sequence)
        OpenSSL::PKey::RSA.new(data_sequence.to_der)
      end
    end
  end
end

::JSON::JWK.prepend MonkeyPatching::JSON::MyJWK