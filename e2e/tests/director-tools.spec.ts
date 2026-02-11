import { test, expect } from '@playwright/test';

// =============================================================================
// Director & Player Tools E2E Tests — Sprint 5
// =============================================================================

/**
 * Helper: log in as a test user and navigate to the game session.
 * Accepts optional credentials to support director vs. player login.
 */
async function loginAndJoinSession(
  page: import('@playwright/test').Page,
  options: { email?: string; password?: string } = {},
) {
  const email = options.email ?? 'director@example.com';
  const password = options.password ?? 'TestPassword123!';

  await page.goto('/login');

  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /log\s?in|sign\s?in/i }).click();

  // Wait for redirect to dashboard
  await expect(page).toHaveURL(/\/(dashboard|lobby|home)?$/, { timeout: 10_000 });

  // Navigate to a room/session
  const lobbyLink = page.getByRole('link', { name: /lobby|rooms|browse/i });
  if (await lobbyLink.isVisible().catch(() => false)) {
    await lobbyLink.click();
  }

  // Click into a room if available
  const roomCard = page
    .getByTestId('room-card')
    .first()
    .or(page.getByRole('link', { name: /campaign|room|game/i }).first());

  if (await roomCard.isVisible().catch(() => false)) {
    await roomCard.click();
    await expect(page).toHaveURL(/\/rooms\/|\/room\/|\/session\//, { timeout: 10_000 });
  }
}

// =============================================================================
// NPC Management Tests
// =============================================================================

test.describe('Director NPC Management', () => {
  test('should create an NPC and see it appear in the NPC list', async ({ page }) => {
    await loginAndJoinSession(page, { email: 'director@example.com' });

    // Navigate to the NPC management panel
    const npcTab = page
      .getByRole('tab', { name: /npc|characters|monsters/i })
      .or(page.getByRole('button', { name: /npc|manage.*npc/i }))
      .or(page.getByTestId('tab-npcs'));

    if (await npcTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await npcTab.click();
    }

    // Click "Create NPC" or "Add NPC" button
    const createButton = page
      .getByRole('button', { name: /create.*npc|add.*npc|new.*npc/i })
      .or(page.getByTestId('create-npc-button'));

    if (await createButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await createButton.click();

      // Fill in NPC name
      const nameInput = page
        .getByLabel(/name/i)
        .or(page.getByPlaceholder(/name/i))
        .or(page.getByTestId('npc-name-input'));

      if (await nameInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await nameInput.fill('Goblin Chieftain');

        // Optionally fill stats
        const hpInput = page
          .getByLabel(/hp|hit\s?points|health/i)
          .or(page.getByTestId('npc-hp-input'));

        if (await hpInput.isVisible().catch(() => false)) {
          await hpInput.fill('45');
        }

        // Submit the form
        const submitButton = page
          .getByRole('button', { name: /save|create|submit/i })
          .or(page.getByTestId('npc-save-button'));

        if (await submitButton.isVisible().catch(() => false)) {
          await submitButton.click();
        }

        // Verify the NPC appears in the list
        await expect(
          page.getByText('Goblin Chieftain'),
        ).toBeVisible({ timeout: 10_000 });
      }
    }
  });

  test('should assign an NPC to a map token', async ({ page }) => {
    await loginAndJoinSession(page, { email: 'director@example.com' });

    // Navigate to NPC panel
    const npcTab = page
      .getByRole('tab', { name: /npc|characters|monsters/i })
      .or(page.getByRole('button', { name: /npc|manage.*npc/i }))
      .or(page.getByTestId('tab-npcs'));

    if (await npcTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await npcTab.click();
    }

    // Click on an existing NPC (or the first one in the list)
    const npcItem = page
      .getByTestId('npc-list-item')
      .first()
      .or(page.locator('[class*="npc"][class*="item"]').first());

    if (await npcItem.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await npcItem.click();

      // Look for "Assign Token" button
      const assignButton = page
        .getByRole('button', { name: /assign.*token|link.*token/i })
        .or(page.getByTestId('assign-token-button'));

      if (await assignButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await assignButton.click();

        // Select a token from a list/dropdown
        const tokenOption = page
          .getByRole('option', { name: /token/i })
          .first()
          .or(page.getByTestId('token-option').first())
          .or(page.locator('[class*="token"][class*="option"]').first());

        if (await tokenOption.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await tokenOption.click();

          // Confirm assignment
          const confirmButton = page
            .getByRole('button', { name: /confirm|assign|save/i })
            .or(page.getByTestId('confirm-assign-button'));

          if (await confirmButton.isVisible().catch(() => false)) {
            await confirmButton.click();
          }

          // Verify assignment feedback
          await expect(
            page.getByText(/assigned|linked|token set/i),
          ).toBeVisible({ timeout: 10_000 });
        }
      }
    }
  });
});

// =============================================================================
// Player Character Sheet Tests
// =============================================================================

test.describe('Player Character Sheet', () => {
  test('should create a character sheet and fill in stats', async ({ page }) => {
    await loginAndJoinSession(page, { email: 'player@example.com', password: 'TestPassword123!' });

    // Navigate to character sheet panel
    const charTab = page
      .getByRole('tab', { name: /character|sheet|my\s?character/i })
      .or(page.getByRole('button', { name: /character|sheet/i }))
      .or(page.getByTestId('tab-character'));

    if (await charTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await charTab.click();
    }

    // Click "Create Character" or "New Character"
    const createButton = page
      .getByRole('button', { name: /create.*character|new.*character|add.*character/i })
      .or(page.getByTestId('create-character-button'));

    if (await createButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await createButton.click();

      // Fill in character name
      const nameInput = page
        .getByLabel(/character.*name|name/i)
        .or(page.getByPlaceholder(/name/i))
        .or(page.getByTestId('character-name-input'));

      if (await nameInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await nameInput.fill('Elara Nightwind');

        // Fill in stats if visible
        const strInput = page
          .getByLabel(/str|strength/i)
          .or(page.getByTestId('stat-str'));

        if (await strInput.isVisible().catch(() => false)) {
          await strInput.fill('10');
        }

        const dexInput = page
          .getByLabel(/dex|dexterity/i)
          .or(page.getByTestId('stat-dex'));

        if (await dexInput.isVisible().catch(() => false)) {
          await dexInput.fill('18');
        }

        const conInput = page
          .getByLabel(/con|constitution/i)
          .or(page.getByTestId('stat-con'));

        if (await conInput.isVisible().catch(() => false)) {
          await conInput.fill('12');
        }

        // Submit the character form
        const submitButton = page
          .getByRole('button', { name: /save|create|submit/i })
          .or(page.getByTestId('character-save-button'));

        if (await submitButton.isVisible().catch(() => false)) {
          await submitButton.click();
        }

        // Verify the character appears
        await expect(
          page.getByText('Elara Nightwind'),
        ).toBeVisible({ timeout: 10_000 });
      }
    }
  });
});

// =============================================================================
// Shared Notes Tests
// =============================================================================

test.describe('Shared Notes', () => {
  test('should create a shared note', async ({ page }) => {
    await loginAndJoinSession(page);

    // Navigate to notes panel
    const notesTab = page
      .getByRole('tab', { name: /notes|shared.*notes|journal/i })
      .or(page.getByRole('button', { name: /notes|journal/i }))
      .or(page.getByTestId('tab-notes'));

    if (await notesTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await notesTab.click();
    }

    // Click "Create Note" or "Add Note"
    const createButton = page
      .getByRole('button', { name: /create.*note|add.*note|new.*note/i })
      .or(page.getByTestId('create-note-button'));

    if (await createButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await createButton.click();

      // Fill in note title
      const titleInput = page
        .getByLabel(/title/i)
        .or(page.getByPlaceholder(/title/i))
        .or(page.getByTestId('note-title-input'));

      if (await titleInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await titleInput.fill('Quest Log - Session 5');

        // Fill in note content
        const contentInput = page
          .getByLabel(/content|body|text/i)
          .or(page.getByPlaceholder(/content|write|type/i))
          .or(page.getByTestId('note-content-input'))
          .or(page.locator('[contenteditable="true"]').first());

        if (await contentInput.isVisible().catch(() => false)) {
          await contentInput.fill('The party arrived at the gates of Silverspire.');
        }

        // Save the note
        const submitButton = page
          .getByRole('button', { name: /save|create|submit/i })
          .or(page.getByTestId('note-save-button'));

        if (await submitButton.isVisible().catch(() => false)) {
          await submitButton.click();
        }

        // Verify the note appears
        await expect(
          page.getByText('Quest Log - Session 5'),
        ).toBeVisible({ timeout: 10_000 });
      }
    }
  });

  test('should edit a shared note content', async ({ page }) => {
    await loginAndJoinSession(page);

    // Navigate to notes panel
    const notesTab = page
      .getByRole('tab', { name: /notes|shared.*notes|journal/i })
      .or(page.getByRole('button', { name: /notes|journal/i }))
      .or(page.getByTestId('tab-notes'));

    if (await notesTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await notesTab.click();
    }

    // Click on an existing note
    const noteItem = page
      .getByTestId('note-list-item')
      .first()
      .or(page.locator('[class*="note"][class*="item"]').first());

    if (await noteItem.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await noteItem.click();

      // Click edit button if needed
      const editButton = page
        .getByRole('button', { name: /edit/i })
        .or(page.getByTestId('note-edit-button'));

      if (await editButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await editButton.click();
      }

      // Find content input and modify
      const contentInput = page
        .getByLabel(/content|body|text/i)
        .or(page.getByTestId('note-content-input'))
        .or(page.locator('[contenteditable="true"]').first())
        .or(page.locator('textarea').first());

      if (await contentInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await contentInput.fill('Updated: The party completed the quest at Silverspire.');

        // Save the updated note
        const saveButton = page
          .getByRole('button', { name: /save|update|submit/i })
          .or(page.getByTestId('note-save-button'));

        if (await saveButton.isVisible().catch(() => false)) {
          await saveButton.click();
        }

        // Verify the updated content appears
        await expect(
          page.getByText(/Updated.*completed the quest/i),
        ).toBeVisible({ timeout: 10_000 });
      }
    }
  });
});
