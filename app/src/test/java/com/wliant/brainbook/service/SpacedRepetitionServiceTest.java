package com.wliant.brainbook.service;

import com.wliant.brainbook.config.DatabaseCleaner;
import com.wliant.brainbook.config.TestContainersConfig;
import com.wliant.brainbook.config.TestDataFactory;
import com.wliant.brainbook.dto.NeuronResponse;
import com.wliant.brainbook.dto.SpacedRepetitionItemResponse;
import com.wliant.brainbook.exception.ResourceNotFoundException;
import com.wliant.brainbook.model.SpacedRepetitionItem;
import io.minio.MinioClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

@SpringBootTest
@Import(TestContainersConfig.class)
@ActiveProfiles("test")
class SpacedRepetitionServiceTest {

    @MockitoBean
    private MinioClient minioClient;

    @Autowired
    private SpacedRepetitionService srService;

    @Autowired
    private DatabaseCleaner databaseCleaner;

    @Autowired
    private TestDataFactory testDataFactory;

    private UUID neuronId;
    private UUID brainId;
    private UUID clusterId;

    @BeforeEach
    void setUp() {
        databaseCleaner.clean();
        TestDataFactory.BrainClusterNeuron chain = testDataFactory.createFullChain();
        brainId = chain.brain().id();
        clusterId = chain.cluster().id();
        neuronId = chain.neuron().id();
    }

    // ── addItem ──

    @Test
    void addItem_createsNewItem() {
        SpacedRepetitionItemResponse response = srService.addItem(neuronId);

        assertThat(response.id()).isNotNull();
        assertThat(response.easeFactor()).isEqualTo(2.5);
        assertThat(response.intervalDays()).isZero();
        assertThat(response.repetitions()).isZero();
        assertThat(response.nextReviewAt()).isNotNull();
        assertThat(response.lastReviewedAt()).isNull();
        assertThat(response.createdAt()).isNotNull();

        // Verify neuronId via getItem (the read-only column is populated on read)
        SpacedRepetitionItemResponse fetched = srService.getItem(neuronId);
        assertThat(fetched.neuronId()).isEqualTo(neuronId);
        assertThat(fetched.neuronTitle()).isEqualTo("Test Neuron");
    }

    @Test
    void addItem_idempotent_returnsSameItem() {
        SpacedRepetitionItemResponse first = srService.addItem(neuronId);
        SpacedRepetitionItemResponse second = srService.addItem(neuronId);

        assertThat(second.id()).isEqualTo(first.id());
    }

    @Test
    void addItem_throwsForNonexistentNeuron() {
        assertThatThrownBy(() -> srService.addItem(UUID.randomUUID()))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    // ── removeItem ──

    @Test
    void removeItem_deletesItem() {
        srService.addItem(neuronId);
        srService.removeItem(neuronId);

        assertThatThrownBy(() -> srService.getItem(neuronId))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void removeItem_noOpForNonexistentItem() {
        srService.removeItem(UUID.randomUUID());
        // no exception thrown
    }

    // ── getItem ──

    @Test
    void getItem_returnsItem() {
        SpacedRepetitionItemResponse added = srService.addItem(neuronId);
        SpacedRepetitionItemResponse retrieved = srService.getItem(neuronId);

        assertThat(retrieved.id()).isEqualTo(added.id());
        assertThat(retrieved.neuronId()).isEqualTo(neuronId);
    }

    @Test
    void getItem_throwsForNotFound() {
        assertThatThrownBy(() -> srService.getItem(UUID.randomUUID()))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    // ── getAllItems ──

    @Test
    void getAllItems_returnsAllItems() {
        NeuronResponse neuron2 = testDataFactory.createNeuron(brainId, clusterId);
        srService.addItem(neuronId);
        srService.addItem(neuron2.id());

        List<SpacedRepetitionItemResponse> items = srService.getAllItems();

        assertThat(items).hasSize(2);
        assertThat(items).extracting(SpacedRepetitionItemResponse::neuronId)
                .containsExactlyInAnyOrder(neuronId, neuron2.id());
    }

    @Test
    void getAllItems_returnsEmptyWhenNone() {
        assertThat(srService.getAllItems()).isEmpty();
    }

    // ── getReviewQueue ──

    @Test
    void getReviewQueue_returnsDueItems() {
        srService.addItem(neuronId);

        List<SpacedRepetitionItemResponse> queue = srService.getReviewQueue();

        assertThat(queue).hasSize(1);
        assertThat(queue.getFirst().neuronId()).isEqualTo(neuronId);
    }

    @Test
    void getReviewQueue_excludesFutureItems() {
        SpacedRepetitionItemResponse added = srService.addItem(neuronId);
        srService.submitReview(added.id(), 5);

        List<SpacedRepetitionItemResponse> queue = srService.getReviewQueue();

        assertThat(queue).isEmpty();
    }

    @Test
    void getReviewQueue_orderedByNextReviewAt() {
        NeuronResponse neuron2 = testDataFactory.createNeuron(brainId, clusterId);
        SpacedRepetitionItemResponse item1 = srService.addItem(neuronId);
        srService.addItem(neuron2.id());

        // Submit review on item1 to push it into the future
        srService.submitReview(item1.id(), 5);

        // Only item2 should be in queue now (item1 is in the future)
        List<SpacedRepetitionItemResponse> queue = srService.getReviewQueue();
        assertThat(queue).hasSize(1);
        assertThat(queue.getFirst().neuronId()).isEqualTo(neuron2.id());
    }

    // ── submitReview ──

    @Test
    void submitReview_updatesItem() {
        SpacedRepetitionItemResponse added = srService.addItem(neuronId);

        SpacedRepetitionItemResponse reviewed = srService.submitReview(added.id(), 4);

        assertThat(reviewed.repetitions()).isEqualTo(1);
        assertThat(reviewed.intervalDays()).isEqualTo(1);
        assertThat(reviewed.lastReviewedAt()).isNotNull();
    }

    @Test
    void submitReview_throwsForNonexistentItem() {
        assertThatThrownBy(() -> srService.submitReview(UUID.randomUUID(), 3))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    // ── SM-2 algorithm ──

    @Test
    void applySm2_quality5_firstReview() {
        SpacedRepetitionItem item = newDefaultItem();
        LocalDateTime now = LocalDateTime.of(2025, 1, 1, 12, 0);

        srService.applySm2(item, 5, now);

        assertThat(item.getRepetitions()).isEqualTo(1);
        assertThat(item.getIntervalDays()).isEqualTo(1);
        assertThat(item.getEaseFactor()).isCloseTo(2.6, within(0.001));
        assertThat(item.getNextReviewAt()).isEqualTo(now.plusDays(1));
    }

    @Test
    void applySm2_quality5_secondReview() {
        SpacedRepetitionItem item = newDefaultItem();
        item.setRepetitions(1);
        item.setIntervalDays(1);
        item.setEaseFactor(2.6);
        LocalDateTime now = LocalDateTime.of(2025, 1, 2, 12, 0);

        srService.applySm2(item, 5, now);

        assertThat(item.getRepetitions()).isEqualTo(2);
        assertThat(item.getIntervalDays()).isEqualTo(6);
        assertThat(item.getEaseFactor()).isCloseTo(2.7, within(0.001));
        assertThat(item.getNextReviewAt()).isEqualTo(now.plusDays(6));
    }

    @Test
    void applySm2_quality5_thirdReview() {
        SpacedRepetitionItem item = newDefaultItem();
        item.setRepetitions(2);
        item.setIntervalDays(6);
        item.setEaseFactor(2.7);
        LocalDateTime now = LocalDateTime.of(2025, 1, 8, 12, 0);

        srService.applySm2(item, 5, now);

        assertThat(item.getRepetitions()).isEqualTo(3);
        assertThat(item.getIntervalDays()).isEqualTo(16); // round(6 * 2.7) = 16
        assertThat(item.getNextReviewAt()).isEqualTo(now.plusDays(16));
    }

    @Test
    void applySm2_quality3_passesButLowersEF() {
        SpacedRepetitionItem item = newDefaultItem();
        LocalDateTime now = LocalDateTime.of(2025, 1, 1, 12, 0);

        srService.applySm2(item, 3, now);

        assertThat(item.getRepetitions()).isEqualTo(1);
        assertThat(item.getIntervalDays()).isEqualTo(1);
        // EF = 2.5 + (0.1 - 2*(0.08 + 2*0.02)) = 2.5 + 0.1 - 0.24 = 2.36
        assertThat(item.getEaseFactor()).isCloseTo(2.36, within(0.001));
    }

    @Test
    void applySm2_quality2_resetsRepetitions() {
        SpacedRepetitionItem item = newDefaultItem();
        item.setRepetitions(3);
        item.setIntervalDays(16);
        item.setEaseFactor(2.5);
        LocalDateTime now = LocalDateTime.of(2025, 1, 1, 12, 0);

        srService.applySm2(item, 2, now);

        assertThat(item.getRepetitions()).isZero();
        assertThat(item.getIntervalDays()).isEqualTo(1);
        // EF = 2.5 + (0.1 - 3*(0.08 + 3*0.02)) = 2.5 + 0.1 - 0.42 = 2.18
        assertThat(item.getEaseFactor()).isCloseTo(2.18, within(0.001));
        assertThat(item.getNextReviewAt()).isEqualTo(now.plusDays(1));
    }

    @Test
    void applySm2_quality0_completeBlackout() {
        SpacedRepetitionItem item = newDefaultItem();
        item.setRepetitions(5);
        item.setIntervalDays(30);
        item.setEaseFactor(2.5);
        LocalDateTime now = LocalDateTime.of(2025, 1, 1, 12, 0);

        srService.applySm2(item, 0, now);

        assertThat(item.getRepetitions()).isZero();
        assertThat(item.getIntervalDays()).isEqualTo(1);
        // EF = 2.5 + (0.1 - 5*(0.08 + 5*0.02)) = 2.5 + 0.1 - 0.9 = 1.7
        assertThat(item.getEaseFactor()).isCloseTo(1.7, within(0.001));
    }

    @Test
    void applySm2_efFloorAt1_3() {
        SpacedRepetitionItem item = newDefaultItem();
        item.setEaseFactor(1.3);
        LocalDateTime now = LocalDateTime.of(2025, 1, 1, 12, 0);

        srService.applySm2(item, 0, now);

        // Raw EF = 1.3 + (0.1 - 0.9) = 0.5, clamped to 1.3
        assertThat(item.getEaseFactor()).isCloseTo(1.3, within(0.001));
    }

    private SpacedRepetitionItem newDefaultItem() {
        SpacedRepetitionItem item = new SpacedRepetitionItem();
        item.setEaseFactor(2.5);
        item.setIntervalDays(0);
        item.setRepetitions(0);
        return item;
    }
}
