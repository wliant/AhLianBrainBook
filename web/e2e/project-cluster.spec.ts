import { test, expect } from '@playwright/test';

const API_BASE = `http://localhost:${process.env.APP_PORT || 28080}`;

test.describe('Project Cluster — sandbox improvements', () => {
  let brainId: string;
  let clusterId: string;

  test.beforeAll(async ({ request }) => {
    const brainRes = await request.post(`${API_BASE}/api/brains`, {
      data: { name: 'E2E Project Test' },
    });
    expect(brainRes.ok()).toBeTruthy();
    const brain = await brainRes.json();
    brainId = brain.id;

    const clusterRes = await request.post(`${API_BASE}/api/clusters`, {
      data: { name: 'E2E Project Cluster', type: 'project', brainId, repoUrl: 'https://github.com/octocat/Hello-World', defaultBranch: 'master' },
    });
    expect(clusterRes.ok()).toBeTruthy();
    const cluster = await clusterRes.json();
    clusterId = cluster.id;
  });

  test.afterAll(async ({ request }) => {
    if (clusterId) await request.delete(`${API_BASE}/api/clusters/${clusterId}`);
    if (brainId) await request.delete(`${API_BASE}/api/brains/${brainId}`);
  });

  test('folder arrows collapsed, search button, and neuron tabs present', async ({ page }) => {
    await page.goto(`/brain/${brainId}/cluster/${clusterId}`);

    // Wait for async cluster data to load and ProjectClusterView to render
    const view = page.getByTestId('project-cluster-view');
    await expect(view).toBeVisible({ timeout: 15000 });

    // File tree panel has FILES header and search button
    const fileTree = page.getByTestId('file-tree-panel');
    await expect(fileTree.getByText('FILES')).toBeVisible();
    await expect(fileTree.getByTitle('Search files (Ctrl+P)')).toBeVisible();

    // No directory is expanded by default — ChevronDown should not be present
    // (there may be no files yet, which is fine — just confirm no expanded folders)
    const expandedChevrons = fileTree.locator('button svg.lucide-chevron-down');
    await expect(expandedChevrons).toHaveCount(0);

    // Neuron panel has both tabs
    const neuronPanel = page.getByTestId('neuron-panel');
    await expect(neuronPanel.getByText('This File')).toBeVisible();
    await expect(neuronPanel.getByText('All Neurons')).toBeVisible();

    // Clicking "All Neurons" tab shows search input
    await neuronPanel.getByText('All Neurons').click();
    await expect(neuronPanel.getByPlaceholder('Search neurons...')).toBeVisible();
  });
});
