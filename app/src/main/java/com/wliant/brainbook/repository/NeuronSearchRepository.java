package com.wliant.brainbook.repository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Repository
public class NeuronSearchRepository {

    private static final Logger logger = LoggerFactory.getLogger(NeuronSearchRepository.class);

    @PersistenceContext
    private EntityManager entityManager;

    public record SearchRow(UUID id, String highlight, double rank) {}

    public record SearchResult(List<SearchRow> rows, long totalCount) {}

    public SearchResult search(String query, UUID brainId, UUID clusterId,
                               List<UUID> neuronTagIds, List<UUID> brainTagIds,
                               int page, int size) {

        String tsquery = "plainto_tsquery('english', :query)";
        String tsvectorContent = "to_tsvector('english', coalesce(n.content_text, ''))";
        String tsvectorTitle = "to_tsvector('english', coalesce(n.title, ''))";

        StringBuilder where = new StringBuilder();
        where.append("WHERE n.is_deleted = false ");
        where.append("AND (").append(tsvectorContent).append(" @@ ").append(tsquery);
        where.append(" OR ").append(tsvectorTitle).append(" @@ ").append(tsquery).append(") ");

        if (brainId != null) {
            where.append("AND n.brain_id = :brainId ");
        }
        if (clusterId != null) {
            where.append("AND n.cluster_id = :clusterId ");
        }
        if (neuronTagIds != null && !neuronTagIds.isEmpty()) {
            where.append("AND (SELECT COUNT(DISTINCT nt.tag_id) FROM neuron_tags nt ")
                 .append("WHERE nt.neuron_id = n.id AND nt.tag_id IN (:neuronTagIds)) = :neuronTagCount ");
        }
        if (brainTagIds != null && !brainTagIds.isEmpty()) {
            where.append("AND (SELECT COUNT(DISTINCT bt.tag_id) FROM brain_tags bt ")
                 .append("WHERE bt.brain_id = n.brain_id AND bt.tag_id IN (:brainTagIds)) = :brainTagCount ");
        }

        // Count query
        String countSql = "SELECT COUNT(*) FROM neurons n " + where;
        Query countQuery = entityManager.createNativeQuery(countSql);
        bindParams(countQuery, query, brainId, clusterId, neuronTagIds, brainTagIds);
        long totalCount = ((Number) countQuery.getSingleResult()).longValue();

        logger.debug("Search query='{}' brainId={} clusterId={} neuronTags={} brainTags={} totalCount={}",
                query, brainId, clusterId,
                neuronTagIds != null ? neuronTagIds.size() : 0,
                brainTagIds != null ? brainTagIds.size() : 0,
                totalCount);

        if (totalCount == 0) {
            return new SearchResult(List.of(), 0);
        }

        // Main query with ranking and highlighting
        // Note: tsquery/tsvector variables contain only SQL function templates with :query param binding,
        // not user input — the actual user query is bound via setParameter("query", ...) in bindParams.
        String selectSql = "SELECT n.id, " +
                "ts_headline('english', coalesce(n.content_text, ''), " + tsquery +
                ", 'StartSel=<mark>, StopSel=</mark>, MaxWords=40, MinWords=20, MaxFragments=2, FragmentDelimiter= ... ') as highlight, " +
                "ts_rank(" + tsvectorContent + ", " + tsquery + ") + " +
                "ts_rank(" + tsvectorTitle + ", " + tsquery + ") * 2.0 as rank " +
                "FROM neurons n " + where +
                "ORDER BY rank DESC " +
                "LIMIT :limit OFFSET :offset";

        Query mainQuery = entityManager.createNativeQuery(selectSql);
        bindParams(mainQuery, query, brainId, clusterId, neuronTagIds, brainTagIds);
        mainQuery.setParameter("limit", size);
        mainQuery.setParameter("offset", page * size);

        @SuppressWarnings("unchecked")
        List<Object[]> rawResults = mainQuery.getResultList();

        List<SearchRow> rows = new ArrayList<>();
        for (Object[] row : rawResults) {
            try {
                UUID id = (UUID) row[0];
                String highlight = (String) row[1];
                double rank = ((Number) row[2]).doubleValue();
                rows.add(new SearchRow(id, highlight, rank));
            } catch (ClassCastException e) {
                logger.error("Unexpected result set structure from search query at row index {}", rows.size(), e);
            }
        }

        return new SearchResult(rows, totalCount);
    }

    private void bindParams(Query query, String searchQuery, UUID brainId, UUID clusterId,
                            List<UUID> neuronTagIds, List<UUID> brainTagIds) {
        query.setParameter("query", searchQuery);
        if (brainId != null) {
            query.setParameter("brainId", brainId);
        }
        if (clusterId != null) {
            query.setParameter("clusterId", clusterId);
        }
        if (neuronTagIds != null && !neuronTagIds.isEmpty()) {
            query.setParameter("neuronTagIds", neuronTagIds);
            query.setParameter("neuronTagCount", (long) neuronTagIds.size());
        }
        if (brainTagIds != null && !brainTagIds.isEmpty()) {
            query.setParameter("brainTagIds", brainTagIds);
            query.setParameter("brainTagCount", (long) brainTagIds.size());
        }
    }
}
