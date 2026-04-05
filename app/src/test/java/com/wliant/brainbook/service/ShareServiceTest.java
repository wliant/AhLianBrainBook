package com.wliant.brainbook.service;

import com.wliant.brainbook.config.DatabaseCleaner;
import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.config.TestDataFactory;
import com.wliant.brainbook.config.TestDataFactory.BrainClusterNeuron;
import com.wliant.brainbook.dto.ShareResponse;
import com.wliant.brainbook.dto.SharedNeuronResponse;
import com.wliant.brainbook.exception.ResourceNotFoundException;
import io.minio.MinioClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Import(TestContainersConfig.class)
@ActiveProfiles("test")
class ShareServiceTest {

    @MockitoBean
    private MinioClient minioClient;

    @Autowired
    private ShareService shareService;

    @Autowired
    private DatabaseCleaner databaseCleaner;

    @Autowired
    private TestDataFactory testDataFactory;

    private BrainClusterNeuron chain;

    @BeforeEach
    void setUp() {
        databaseCleaner.clean();
        chain = testDataFactory.createFullChain();
    }

    @Test
    void createShareLink_generatesValidToken() {
        ShareResponse response = shareService.createShareLink(chain.neuron().id(), null);

        assertThat(response.id()).isNotNull();
        assertThat(response.token()).hasSize(64);
        assertThat(response.token()).matches("[0-9a-f]{64}");
        assertThat(response.expiresAt()).isNull();
        assertThat(response.createdAt()).isNotNull();
    }

    @Test
    void createShareLink_withExpiry_setsExpiresAt() {
        ShareResponse response = shareService.createShareLink(chain.neuron().id(), 24);

        assertThat(response.expiresAt()).isNotNull();
        assertThat(response.token()).hasSize(64);
    }

    @Test
    void createShareLink_neuronNotFound_throws() {
        UUID fakeId = UUID.randomUUID();

        assertThatThrownBy(() -> shareService.createShareLink(fakeId, null))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void getSharedNeuron_validToken_returnsContent() {
        ShareResponse share = shareService.createShareLink(chain.neuron().id(), null);

        SharedNeuronResponse response = shareService.getSharedNeuron(share.token());

        assertThat(response.title()).isEqualTo(chain.neuron().title());
        assertThat(response.brainName()).isEqualTo(chain.brain().name());
        assertThat(response.createdAt()).isNotNull();
    }

    @Test
    void getSharedNeuron_unknownToken_throws() {
        assertThatThrownBy(() -> shareService.getSharedNeuron("nonexistent_token"))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void getSharesForNeuron_returnsList() {
        shareService.createShareLink(chain.neuron().id(), null);
        shareService.createShareLink(chain.neuron().id(), 24);

        List<ShareResponse> shares = shareService.getSharesForNeuron(chain.neuron().id());

        assertThat(shares).hasSize(2);
    }

    @Test
    void revokeShare_removesShare() {
        ShareResponse share = shareService.createShareLink(chain.neuron().id(), null);

        shareService.revokeShare(share.id());

        List<ShareResponse> shares = shareService.getSharesForNeuron(chain.neuron().id());
        assertThat(shares).isEmpty();
    }

    @Test
    void revokeShare_unknownId_throws() {
        UUID fakeId = UUID.randomUUID();

        assertThatThrownBy(() -> shareService.revokeShare(fakeId))
                .isInstanceOf(ResourceNotFoundException.class);
    }
}
