// @flow
import * as React from 'react';
import { debounce } from 'lodash';
import styled from 'styled-components';
import breakpoint from 'styled-components-breakpoint';
import { observable } from 'mobx';
import { observer, inject } from 'mobx-react';
import { Prompt, Route, withRouter } from 'react-router-dom';
import type { Location, RouterHistory } from 'react-router-dom';
import keydown from 'react-keydown';
import Flex from 'shared/components/Flex';
import {
  collectionUrl,
  documentMoveUrl,
  documentHistoryUrl,
  documentEditUrl,
} from 'utils/routeHelpers';
import { emojiToUrl } from 'utils/emoji';

import Header from './Header';
import DocumentMove from './DocumentMove';
import Branding from './Branding';
import KeyboardShortcuts from './KeyboardShortcuts';
import References from './References';
import Loading from './Loading';
import Container from './Container';
import MarkAsViewed from './MarkAsViewed';
import ErrorBoundary from 'components/ErrorBoundary';
import LoadingIndicator from 'components/LoadingIndicator';
import PageTitle from 'components/PageTitle';
import Notice from 'shared/components/Notice';
import Time from 'shared/components/Time';

import UiStore from 'stores/UiStore';
import AuthStore from 'stores/AuthStore';
import Document from 'models/Document';
import Revision from 'models/Revision';

import schema from '../schema';

let EditorImport;
const AUTOSAVE_DELAY = 3000;
const IS_DIRTY_DELAY = 500;
const DISCARD_CHANGES = `
You have unsaved changes.
Are you sure you want to discard them?
`;
const UPLOADING_WARNING = `
Images are still uploading.
Are you sure you want to discard them?
`;

type Props = {
  match: Object,
  history: RouterHistory,
  location: Location,
  abilities: Object,
  document: Document,
  revision: Revision,
  readOnly: boolean,
  onSearchLink: (term: string) => mixed,
  auth: AuthStore,
  ui: UiStore,
};

@observer
class DocumentScene extends React.Component<Props> {
  getEditorText: () => string;

  @observable editorComponent = EditorImport;
  @observable isUploading: boolean = false;
  @observable isSaving: boolean = false;
  @observable isPublishing: boolean = false;
  @observable isDirty: boolean = false;
  @observable isEmpty: boolean = true;
  @observable moveModalOpen: boolean = false;

  constructor(props) {
    super();
    this.loadEditor();
  }

  // @keydown('m')
  goToMove(ev) {
    ev.preventDefault();
    const { document, abilities } = this.props;

    if (abilities.update) {
      this.props.history.push(documentMoveUrl(document));
    }
  }

  // @keydown('e')
  goToEdit(ev) {
    ev.preventDefault();
    const { document, abilities } = this.props;

    if (abilities.update) {
      this.props.history.push(documentEditUrl(document));
    }
  }

  // @keydown('esc')
  goBack(ev) {
    if (this.props.readOnly) return;

    ev.preventDefault();
    this.props.history.goBack();
  }

  // @keydown('h')
  goToHistory(ev) {
    ev.preventDefault();
    const { document, revision } = this.props;

    if (revision) {
      this.props.history.push(document.url);
    } else {
      this.props.history.push(documentHistoryUrl(document));
    }
  }

  // @keydown('meta+shift+p')
  onPublish(ev) {
    ev.preventDefault();
    const { document } = this.props;
    if (document.publishedAt) return;
    this.onSave({ publish: true, done: true });
  }

  loadEditor = async () => {
    if (this.editorComponent) return;

    const Imported = await import('./Editor');
    EditorImport = Imported.default;
    this.editorComponent = EditorImport;
  };

  handleCloseMoveModal = () => (this.moveModalOpen = false);
  handleOpenMoveModal = () => (this.moveModalOpen = true);

  onSave = async (
    options: { done?: boolean, publish?: boolean, autosave?: boolean } = {}
  ) => {
    const { document } = this.props;

    // prevent saves when we are already saving
    if (document.isSaving) return;

    // get the latest version of the editor text value
    const text = this.getEditorText ? this.getEditorText() : document.text;

    // prevent save before anything has been written (single hash is empty doc)
    if (text.trim() === '#') return;

    // prevent autosave if nothing has changed
    if (options.autosave && document.text.trim() === text.trim()) return;

    document.text = text;

    let isNew = !document.id;
    this.isSaving = true;
    this.isPublishing = !!options.publish;
    const savedDocument = await document.save(options);
    this.isDirty = false;
    this.isSaving = false;
    this.isPublishing = false;

    if (options.done) {
      this.props.history.push(savedDocument.url);
      this.props.ui.setActiveDocument(savedDocument);
    } else if (isNew) {
      this.props.history.push(documentEditUrl(savedDocument));
      this.props.ui.setActiveDocument(savedDocument);
    }
  };

  autosave = debounce(() => {
    this.onSave({ done: false, autosave: true });
  }, AUTOSAVE_DELAY);

  updateIsDirty = debounce(() => {
    const { document } = this.props;
    const editorText = this.getEditorText().trim();

    // a single hash is a doc with just an empty title
    this.isEmpty = editorText === '#';
    this.isDirty = !!document && editorText !== document.text.trim();
  }, IS_DIRTY_DELAY);

  onImageUploadStart = () => {
    this.isUploading = true;
  };

  onImageUploadStop = () => {
    this.isUploading = false;
  };

  onChange = getEditorText => {
    this.getEditorText = getEditorText;
    this.updateIsDirty();
    this.autosave();
  };

  goBack = () => {
    let url;
    if (this.props.document.url) {
      url = this.props.document.url;
    } else {
      url = collectionUrl(this.props.match.params.id);
    }
    this.props.history.push(url);
  };

  render() {
    const { document, revision, readOnly, location, auth, match } = this.props;
    const team = auth.team;
    const Editor = this.editorComponent;
    const isShare = match.params.shareId;

    if (!Editor) {
      return <Loading location={location} />;
    }

    const embedsDisabled = team && !team.documentEmbeds;

    return (
      <ErrorBoundary>
        <Container
          key={revision ? revision.id : document.id}
          isShare={isShare}
          column
          auto
        >
          <Route
            path={`${match.url}/move`}
            component={() => (
              <DocumentMove document={document} onRequestClose={this.goBack} />
            )}
          />
          <PageTitle
            title={document.title.replace(document.emoji, '') || 'Untitled'}
            favicon={document.emoji ? emojiToUrl(document.emoji) : undefined}
          />
          {(this.isUploading || this.isSaving) && <LoadingIndicator />}

          <Container justify="center" column auto>
            {!readOnly && (
              <React.Fragment>
                <Prompt
                  when={this.isDirty && !this.isUploading}
                  message={DISCARD_CHANGES}
                />
                <Prompt
                  when={this.isUploading && !this.isDirty}
                  message={UPLOADING_WARNING}
                />
              </React.Fragment>
            )}
            {!isShare && (
              <Header
                document={document}
                isRevision={!!revision}
                isDraft={document.isDraft}
                isEditing={!readOnly}
                isSaving={this.isSaving}
                isPublishing={this.isPublishing}
                publishingIsDisabled={
                  document.isSaving || this.isPublishing || this.isEmpty
                }
                savingIsDisabled={document.isSaving || this.isEmpty}
                goBack={this.goBack}
                onSave={this.onSave}
              />
            )}
            <MaxWidth archived={document.isArchived} column auto>
              {document.archivedAt &&
                !document.deletedAt && (
                  <Notice muted>
                    Archived by {document.updatedBy.name}{' '}
                    <Time dateTime={document.archivedAt} /> ago
                  </Notice>
                )}
              {document.deletedAt && (
                <Notice muted>
                  Deleted by {document.updatedBy.name}{' '}
                  <Time dateTime={document.deletedAt} /> ago
                  {document.permanentlyDeletedAt && (
                    <React.Fragment>
                      <br />
                      This document will be permanently deleted in{' '}
                      <Time dateTime={document.permanentlyDeletedAt} /> unless
                      restored.
                    </React.Fragment>
                  )}
                </Notice>
              )}
              <Editor
                id={document.id}
                key={embedsDisabled ? 'embeds-disabled' : 'embeds-enabled'}
                defaultValue={revision ? revision.text : document.text}
                pretitle={document.emoji}
                disableEmbeds={embedsDisabled}
                onImageUploadStart={this.onImageUploadStart}
                onImageUploadStop={this.onImageUploadStop}
                onSearchLink={this.props.onSearchLink}
                onChange={this.onChange}
                onSave={this.onSave}
                onPublish={this.onPublish}
                onCancel={this.goBack}
                readOnly={readOnly || document.isArchived}
                toc={!revision}
                ui={this.props.ui}
                schema={schema}
              />
              {readOnly &&
                !isShare &&
                !revision && (
                  <React.Fragment>
                    <MarkAsViewed document={document} />
                    <ReferencesWrapper isOnlyTitle={document.isOnlyTitle}>
                      <References document={document} />
                    </ReferencesWrapper>
                  </React.Fragment>
                )}
            </MaxWidth>
          </Container>
        </Container>
        {isShare ? <Branding /> : <KeyboardShortcuts />}
      </ErrorBoundary>
    );
  }
}

const ReferencesWrapper = styled('div')`
  margin-top: ${props => (props.isOnlyTitle ? -45 : 16)}px;
`;

const MaxWidth = styled(Flex)`
  ${props =>
    props.archived && `* { color: ${props.theme.textSecondary} !important; } `};
  padding: 0 16px;
  max-width: 100vw;
  width: 100%;

  ${breakpoint('tablet')`	
    padding: 0 24px;
    margin: 4px auto 12px;
    max-width: 46em;
    box-sizing: content-box;
  `};
`;

export default withRouter(
  inject('ui', 'auth', 'documents', 'policies', 'revisions')(DocumentScene)
);
