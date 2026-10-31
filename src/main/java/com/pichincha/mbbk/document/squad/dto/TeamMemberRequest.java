package com.pichincha.mbbk.document.squad.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record TeamMemberRequest(
        @Min(1)
        Integer orden,

        @NotBlank
        @Size(max = 150)
        String nombre,

        @NotBlank
        @Size(max = 150)
        String rol,

        @Email
        @Size(max = 150)
        String correo,

        @Size(max = 40)
        String numero
) {
}
