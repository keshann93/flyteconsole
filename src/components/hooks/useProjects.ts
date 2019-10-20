import { useContext } from 'react';

import { CacheContext, ValueCache } from 'components/Cache';
import { listProjects, Project } from 'models';

import { NotFoundError } from 'errors';
import { FetchableData } from './types';
import { useFetchableData } from './useFetchableData';

const fetchableKey = Symbol('ProjectsList');
const makeProjectsCacheKey = (host?: string) => ({
    host,
    collection: fetchableKey
});
const makeProjectCacheKey = (id: string, host?: string) => ({
    id,
    host,
    collection: fetchableKey
});

const doFetchProjects = async (cache: ValueCache, host?: string) => {
    const projects = await listProjects(host);
    // Individually cache the projects so that we can retrieve them by id
    return projects.map(p =>
        cache.mergeValue(makeProjectCacheKey(p.id, host), p)
    ) as Project[];
};

/** A hook for fetching the list of available projects*/
export function useProjects(host?: string): FetchableData<Project[]> {
    const cache = useContext(CacheContext);

    return useFetchableData<Project[], Symbol>(
        {
            debugName: 'Projects',
            useCache: false,
            defaultValue: [],
            doFetch: () => doFetchProjects(cache, host)
        },
        makeProjectsCacheKey(host)
    );
}

/** A hook for fetching a single Project */
export function useProject(id: string, host?: string): FetchableData<Project> {
    const cache = useContext(CacheContext);

    const doFetch = async () => {
        await doFetchProjects(cache, host);
        const project = cache.get(makeProjectCacheKey(id, host)) as Project;
        if (!project) {
            throw new NotFoundError(id);
        }
        if (host) {
            project.host = host;
        }
        return project;
    };

    return useFetchableData<Project, object>(
        {
            doFetch,
            useCache: true,
            debugName: 'Projects',
            defaultValue: {} as Project
        },
        makeProjectCacheKey(id, host)
    );
}
