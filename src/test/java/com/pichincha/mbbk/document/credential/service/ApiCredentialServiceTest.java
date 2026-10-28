package com.pichincha.mbbk.document.credential.service;

import com.pichincha.mbbk.document.credential.dto.ApiCredentialRequest;
import com.pichincha.mbbk.document.credential.dto.ApiCredentialResponse;
import com.pichincha.mbbk.document.credential.entity.ApiCredential;
import com.pichincha.mbbk.document.credential.repository.ApiCredentialRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ApiCredentialServiceTest {

    @Mock
    private ApiCredentialRepository repository;

    @InjectMocks
    private ApiCredentialService service;

    @Test
    void upsertsJiraTokenInSameTableAsGithub() {
        when(repository.findByProveedorIgnoreCaseAndClaveIgnoreCase("jira", "JIRA_API_TOKEN"))
                .thenReturn(Optional.empty());
        when(repository.save(any(ApiCredential.class))).thenAnswer(invocation -> {
            ApiCredential credential = invocation.getArgument(0);
            credential.setId(UUID.fromString("22222222-2222-2222-2222-222222222222"));
            return credential;
        });

        ApiCredentialResponse response = service.upsert(new ApiCredentialRequest(
                "jira",
                "JIRA_API_TOKEN",
                "atlassian-token",
                "Token Jira Cloud"
        ));

        assertEquals("jira", response.proveedor());
        assertEquals("JIRA_API_TOKEN", response.clave());
        assertEquals("********", response.valor());
        assertTrue(response.configurado());
    }

    @Test
    void exposesJiraEmailWithoutMasking() {
        ApiCredential row = new ApiCredential();
        row.setId(UUID.fromString("33333333-3333-3333-3333-333333333333"));
        row.setProveedor("jira");
        row.setClave("JIRA_EMAIL");
        row.setValor("pquispe-ext@pichincha.pe");
        row.setDescripcion("Correo Atlassian");
        when(repository.findByClaveIgnoreCase("JIRA_EMAIL")).thenReturn(Optional.of(row));

        ApiCredentialResponse response = service.findByClave("JIRA_EMAIL");

        assertEquals("pquispe-ext@pichincha.pe", response.valor());
        assertTrue(response.configurado());
    }
}
